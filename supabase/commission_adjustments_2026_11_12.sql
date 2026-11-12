-- Kover commission adjustments and policy-save fixes (12/11/2026).
-- Additive only: no existing commission, statement or policy rows are rewritten.
-- Requires policy_accuracy_endorsements_2026_11_11.sql to have been run first.
begin;
alter table public.commissions
  add column if not exists entry_kind text,
  add column if not exists adjustment_note text;
alter table public.commission_payment_items
  add column if not exists entry_kind_snapshot text,
  add column if not exists adjustment_note_snapshot text;
alter table public.commission_payment_batches add column if not exists has_adjustments boolean;

-- Retain all original checks for normal rows; allow signed adjustment amounts.
do $$
declare r record; expression text;
begin
  for r in select conname,pg_get_constraintdef(oid) as definition from pg_constraint
    where conrelid='public.commissions'::regclass and contype='c'
      and pg_get_constraintdef(oid) ~ '\m(amount|unpaid_amount)\M'
      and pg_get_constraintdef(oid) not like '%entry_kind%'
  loop
    expression:=regexp_replace(r.definition,'^CHECK ','');
    execute format('alter table public.commissions drop constraint %I',r.conname);
    execute format('alter table public.commissions add constraint %I check (entry_kind is not distinct from ''adjustment'' or %s)',r.conname,expression);
  end loop;
  for r in select conname,pg_get_constraintdef(oid) as definition from pg_constraint
    where conrelid='public.commission_payment_items'::regclass and contype='c'
      and pg_get_constraintdef(oid) ~ '\mamount_payable\M'
      and pg_get_constraintdef(oid) not like '%entry_kind_snapshot%'
  loop
    expression:=regexp_replace(r.definition,'^CHECK ','');
    execute format('alter table public.commission_payment_items drop constraint %I',r.conname);
    execute format('alter table public.commission_payment_items add constraint %I check (entry_kind_snapshot is not distinct from ''adjustment'' or %s)',r.conname,expression);
  end loop;
  for r in select conname,pg_get_constraintdef(oid) as definition from pg_constraint
    where conrelid='public.commission_payment_batches'::regclass and contype='c'
      and pg_get_constraintdef(oid) ~ '\mtotal_amount\M'
      and pg_get_constraintdef(oid) not like '%has_adjustments%'
  loop
    expression:=regexp_replace(r.definition,'^CHECK ','');
    execute format('alter table public.commission_payment_batches drop constraint %I',r.conname);
    execute format('alter table public.commission_payment_batches add constraint %I check (has_adjustments is true or %s)',r.conname,expression);
  end loop;
end $$;

-- A legacy one-row-per-payee uniqueness rule must apply only to calculated rows.
do $$
declare r record; constraint_name text;
begin
 for r in select i.indexrelid,ci.relname from pg_index i join pg_class ci on ci.oid=i.indexrelid
 where i.indrelid='public.commissions'::regclass and i.indisunique and not i.indisprimary and i.indpred is null
 and (select array_agg(a.attname::text order by a.attname) from unnest(i.indkey) k join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k)=array['payee_id','policy_term_id']
 loop
  select conname into constraint_name from pg_constraint where conindid=r.indexrelid and contype='u';
  if constraint_name is not null then execute format('alter table public.commissions drop constraint %I',constraint_name);
  else execute format('drop index public.%I',r.relname); end if;
  create unique index if not exists commissions_normal_policy_payee_unique on public.commissions(policy_term_id,payee_id) where entry_kind is distinct from 'adjustment';
 end loop;
end $$;

create or replace function public.kover_guard_adjustment()
returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op <> 'INSERT' and old.entry_kind='adjustment' then
  if tg_op='DELETE' then
   if old.status::text is distinct from 'unpaid' or old.payment_batch_id is not null then raise exception 'Paid adjustments are locked and cannot be deleted.'; end if;
   return old;
  end if;
  if old.status::text='paid' and (to_jsonb(new)-array['paid_date','updated_at']) is distinct from (to_jsonb(old)-array['paid_date','updated_at']) then
   raise exception 'Paid adjustments are locked. Only Paid date may be corrected.';
  end if;
  if new.entry_kind is distinct from old.entry_kind then raise exception 'Adjustment type cannot be changed.'; end if;
 end if;
 if tg_op='UPDATE' and old.entry_kind is distinct from 'adjustment' and new.entry_kind='adjustment' then
  raise exception 'Create a separate adjustment; existing commissions cannot be converted.';
 end if;
 if tg_op <> 'DELETE' and new.entry_kind='adjustment' then
  if nullif(trim(new.adjustment_note),'') is null then raise exception 'An adjustment note is required.'; end if;
  if new.calculation_percent is not null or new.auto_amount is not null or new.auto_calculation_percent is not null then raise exception 'Adjustment amounts must be fixed, not rate-based.'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
drop trigger if exists kover_adjustment_guard on public.commissions;
create trigger kover_adjustment_guard before insert or update or delete on public.commissions for each row execute function public.kover_guard_adjustment();

create or replace function public.kover_log_commission_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare b jsonb; a jsonb; term uuid; key text;
begin
 if tg_op <> 'INSERT' then b:=to_jsonb(old); end if;
 if tg_op <> 'DELETE' then a:=to_jsonb(new); end if;
 term:=coalesce(a->>'policy_term_id',b->>'policy_term_id')::uuid;
 if coalesce(a->>'entry_kind',b->>'entry_kind')='adjustment' and tg_op in ('INSERT','DELETE') then
  insert into public.policy_change_history(policy_term_id,field_name,old_value,new_value)
  values(term,'commission_adjustment.'||lower(tg_op),b,a);
 elsif tg_op='UPDATE' then
  foreach key in array array['payee_id','amount','adjustment_note','paid_date','status'] loop
   if b->key is distinct from a->key then
    insert into public.policy_change_history(policy_term_id,field_name,old_value,new_value)
    values(term,case when a->>'entry_kind'='adjustment' then 'commission_adjustment.' else 'commission.' end || key,
      jsonb_build_object('commission_id',a->>'id','value',b->key),jsonb_build_object('commission_id',a->>'id','value',a->key));
   end if;
  end loop;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
drop trigger if exists kover_commission_history on public.commissions;
create trigger kover_commission_history after insert or update or delete on public.commissions for each row execute function public.kover_log_commission_change();

create or replace function public.kover_save_adjustment(p_term_id uuid,p_id uuid,p_payee_id uuid,p_amount numeric,p_note text,p_status text default 'unpaid',p_paid_date date default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare c public.commissions; parsed public.commissions; result_id uuid;
begin
 if auth.uid() is null then raise exception 'You must be logged in.'; end if;
 perform 1 from public.policy_terms where id=p_term_id for update;
 if not found then raise exception 'Policy not found.'; end if;
 if p_amount is null or p_amount<>round(p_amount,2) or abs(p_amount)>=1e12 then raise exception 'Enter an amount with at most 2 decimal places.'; end if;
 if nullif(trim(p_note),'') is null then raise exception 'An adjustment note is required.'; end if;
 if p_status not in ('unpaid','paid') or p_status is null then raise exception 'Invalid adjustment status.'; end if;
 if p_status='paid' and p_paid_date is null then raise exception 'Paid date is required.'; end if;
 if not exists(select 1 from public.commission_payees where id=p_payee_id) then raise exception 'Select a valid payee.'; end if;
 parsed:=jsonb_populate_record(null::public.commissions,jsonb_build_object('status',p_status));
 if p_id is null then
  insert into public.commissions(policy_term_id,payee_id,entry_kind,adjustment_note,amount,unpaid_amount,status,paid_date,is_custom)
  values(p_term_id,p_payee_id,'adjustment',trim(p_note),p_amount,case when p_status='paid' then 0 else p_amount end,parsed.status,case when p_status='paid' then p_paid_date else null end,true)
  returning id into result_id;
 else
  select * into strict c from public.commissions where id=p_id and policy_term_id=p_term_id for update;
  if c.entry_kind is distinct from 'adjustment' or c.status::text is distinct from 'unpaid' or c.payment_batch_id is not null then raise exception 'Only unpaid adjustment rows can be edited.'; end if;
  update public.commissions set payee_id=p_payee_id,amount=p_amount,unpaid_amount=case when p_status='paid' then 0 else p_amount end,
   adjustment_note=trim(p_note),status=parsed.status,paid_date=case when p_status='paid' then p_paid_date else null end where id=p_id;
  result_id:=p_id;
 end if;
 return result_id;
end $$;

create or replace function public.kover_delete_adjustment(p_term_id uuid,p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare c public.commissions;
begin
 if auth.uid() is null then raise exception 'You must be logged in.'; end if;
 perform 1 from public.policy_terms where id=p_term_id for update;
 select * into strict c from public.commissions where id=p_id and policy_term_id=p_term_id for update;
 if c.entry_kind is distinct from 'adjustment' or c.status::text is distinct from 'unpaid' or c.payment_batch_id is not null then raise exception 'Only unpaid adjustments can be deleted.'; end if;
 delete from public.commissions where id=p_id;
end $$;

create or replace function public.kover_commission_paid_date(p_id uuid,p_date date)
returns void language plpgsql security definer set search_path=public as $$
declare term uuid; c public.commissions;
begin
 if auth.uid() is null then raise exception 'You must be logged in.'; end if;
 if p_date is null then raise exception 'Paid date is required.'; end if;
 select policy_term_id into strict term from public.commissions where id=p_id;
 perform 1 from public.policy_terms where id=term for update;
 select * into strict c from public.commissions where id=p_id for update;
 if c.status::text is distinct from 'paid' then raise exception 'Only paid rows have an editable Paid date.'; end if;
 update public.commissions set paid_date=p_date where id=p_id;
 -- Statement snapshots and the statement link intentionally remain unchanged.
end $$;

create or replace function public.kover_toggle_policy_commissions(p_term_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare all_paid boolean; n integer;
begin
 if auth.uid() is null then raise exception 'You must be logged in.'; end if;
 perform 1 from public.policy_terms where id=p_term_id for update;
 perform 1 from public.commissions where policy_term_id=p_term_id order by id for update;
 select bool_and(status::text='paid'),count(*) into all_paid,n from public.commissions where policy_term_id=p_term_id;
 if n=0 then raise exception 'No commission rows to update.'; end if;
 if all_paid then
  update public.commissions set status='unpaid',unpaid_amount=amount,paid_date=null
   where policy_term_id=p_term_id and entry_kind is distinct from 'adjustment';
  get diagnostics n=row_count;
  if n=0 then raise exception 'Paid adjustment rows are locked. Add a separate adjustment to correct them.'; end if;
  return 'Marked normal commissions unpaid. Paid adjustments and statements were kept.';
 else
  if exists(select 1 from public.commissions c join public.policy_terms t on t.id=c.policy_term_id
    where c.policy_term_id=p_term_id and c.status::text<>'paid' and c.entry_kind is distinct from 'adjustment' and t.premium_status::text is distinct from 'paid') then
    raise exception 'Mark the premium paid before paying normal commissions.';
  end if;
  update public.commissions set status='paid',unpaid_amount=0,paid_date=current_date where policy_term_id=p_term_id and status::text<>'paid';
  return 'Commission marked paid.';
 end if;
end $$;

create or replace function public.kover_confirm_commission_payment(p_ids uuid[],p_paid_date date,p_notes text default null)
returns integer language plpgsql security definer set search_path=public as $$
declare r record; batch uuid; n integer; total numeric; has_adjust boolean; seq integer; prefix text;
begin
 if auth.uid() is null then raise exception 'You must be logged in.'; end if;
 if p_paid_date is null then raise exception 'Paid date is required.'; end if;
 if coalesce(cardinality(p_ids),0)=0 then raise exception 'Select at least one commission.'; end if;
 if cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids) x) then raise exception 'Duplicate commission selection.'; end if;
 perform 1 from public.policy_terms where id in(select policy_term_id from public.commissions where id=any(p_ids)) order by id for update;
 perform 1 from public.commissions where id=any(p_ids) order by id for update;
 select count(*) into n from public.commissions where id=any(p_ids) and status::text='unpaid';
 if n<>cardinality(p_ids) then raise exception 'Some selected rows are already paid or unavailable. Refresh and try again.'; end if;
 if exists(select 1 from public.commissions c join public.policy_terms t on t.id=c.policy_term_id where c.id=any(p_ids)
  and c.entry_kind is distinct from 'adjustment' and t.premium_status::text is distinct from 'paid') then raise exception 'Premium must be paid before normal commission.'; end if;
 if exists(select 1 from public.commissions where id=any(p_ids) and entry_kind is distinct from 'adjustment' and coalesce(unpaid_amount,amount)<0) then raise exception 'Only adjustment rows can have negative amounts.'; end if;
 perform pg_advisory_xact_lock(hashtext('kover_commission_statements'));
 prefix:='COMM-'||extract(year from current_date)::text||'-';
 for r in select distinct payee_id from public.commissions where id=any(p_ids) order by payee_id loop
  select sum(case when entry_kind='adjustment' then amount else coalesce(unpaid_amount,amount) end),bool_or(entry_kind='adjustment')
   into total,has_adjust from public.commissions where id=any(p_ids) and payee_id=r.payee_id;
  select coalesce(max(substring(statement_no from '[0-9]+$')::integer),0)+1 into seq from public.commission_payment_batches where statement_no like prefix||'%';
  insert into public.commission_payment_batches(statement_no,payee_id,paid_date,statement_date,total_amount,status,notes,has_adjustments)
   values(prefix||lpad(seq::text,4,'0'),r.payee_id,p_paid_date,current_date,total,'paid',p_notes,coalesce(has_adjust,false)) returning id into batch;
  insert into public.commission_payment_items(batch_id,commission_id,amount_payable,client_name_snapshot,policy_number_snapshot,insurance_type_snapshot,insurer_name_snapshot,effective_date_snapshot,expiry_date_snapshot,gross_premium_snapshot,commission_percent_snapshot,entry_kind_snapshot,adjustment_note_snapshot)
  select batch,c.id,case when c.entry_kind='adjustment' then c.amount else coalesce(c.unpaid_amount,c.amount) end,
   cl.client_name,t.policy_number,it.name,i.insurer_name,t.effective_date,t.expiry_date,t.gross_premium,c.calculation_percent,c.entry_kind,c.adjustment_note
   from public.commissions c join public.policy_terms t on t.id=c.policy_term_id
   left join public.clients cl on cl.id=t.client_id left join public.insurance_types it on it.id=t.insurance_type_id left join public.insurers i on i.id=t.insurer_id
   where c.id=any(p_ids) and c.payee_id=r.payee_id;
  update public.commissions set status='paid',unpaid_amount=0,paid_date=p_paid_date,payment_batch_id=batch where id=any(p_ids) and payee_id=r.payee_id;
 end loop;
 return n;
end $$;

-- Append snapshots to the view without changing any existing view columns.
do $$
declare definition text;
begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='commission_payment_statement_view' and column_name='adjustment_note_snapshot') then
  definition:=regexp_replace(pg_get_viewdef('public.commission_payment_statement_view'::regclass,true),';[[:space:]]*$','');
  execute format('create or replace view public.commission_payment_statement_view with (security_invoker=true) as select legacy.*, item.entry_kind_snapshot,item.adjustment_note_snapshot from (%s) legacy left join public.commission_payment_items item on item.id=legacy.item_id',definition);
 end if;
end $$;

create or replace function public.kover_recalculate_commissions(p_term_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t public.policy_terms; r record; rate numeric; fixed_rate numeric; equal_count integer; existing_id uuid;
begin
  select * into strict t from public.policy_terms where id=p_term_id for update;
  perform 1 from public.commissions where policy_term_id=p_term_id and entry_kind is distinct from 'adjustment' for update;
  if t.split_pattern_id is null or t.gross_premium is null then return; end if;
  if not exists(select 1 from public.commission_split_rules where split_pattern_id=t.split_pattern_id) then
    raise exception 'Selected split pattern has no commission rules.';
  end if;
  select coalesce(sum(fixed_percent) filter(where rule_type::text='fixed_percent_of_gross'),0),
    greatest(count(*) filter(where rule_type::text='equal_net_share'),1)
    into fixed_rate,equal_count from public.commission_split_rules where split_pattern_id=t.split_pattern_id;
  if exists(select 1 from public.commissions c where c.policy_term_id=p_term_id and c.entry_kind is distinct from 'adjustment' and c.status::text <> 'paid'
    and not exists(select 1 from public.commission_split_rules sr where sr.split_pattern_id=t.split_pattern_id and sr.payee_id=c.payee_id)) then
    raise exception 'Existing unpaid payees differ from this split. Keep existing commissions or settle the old allocation before changing the split.';
  end if;
  for r in select * from public.commission_split_rules where split_pattern_id=t.split_pattern_id order by sort_order loop
    if exists(select 1 from public.commissions where policy_term_id=p_term_id and entry_kind is distinct from 'adjustment' and payee_id=r.payee_id and status::text='paid') then continue; end if;
    rate := case r.rule_type::text
      when 'gross_commission_share' then coalesce(t.gross_commission_percent,0)*coalesce(r.share_percent,0)
      when 'net_commission_share' then coalesce(t.net_commission_percent,0)*coalesce(r.share_percent,0)
      when 'fixed_percent_of_gross' then coalesce(r.fixed_percent,0)
      when 'remaining_net_after_fixed_percent' then greatest(coalesce(t.net_commission_percent,0)-fixed_rate,0)
      when 'equal_net_share' then coalesce(t.net_commission_percent,0)/equal_count
      else null end;
    if rate is null then raise exception 'Unsupported commission rule: %',r.rule_type; end if;
    if (select count(*) from public.commissions where policy_term_id=p_term_id and entry_kind is distinct from 'adjustment' and payee_id=r.payee_id) > 1 then
      raise exception 'Multiple commission rows exist for one payee. Review them before recalculating.';
    end if;
    select id into existing_id from public.commissions where policy_term_id=p_term_id and entry_kind is distinct from 'adjustment' and payee_id=r.payee_id;
    if existing_id is null then
      insert into public.commissions(policy_term_id,payee_id,split_pattern_id,calculation_percent,amount,unpaid_amount,status,auto_calculation_percent,auto_amount,is_custom)
      values(p_term_id,r.payee_id,t.split_pattern_id,rate,round(t.gross_premium*rate,2),round(t.gross_premium*rate,2),'unpaid',rate,round(t.gross_premium*rate,2),false);
    else
      update public.commissions set split_pattern_id=t.split_pattern_id,calculation_percent=rate,
        amount=round(t.gross_premium*rate,2),unpaid_amount=round(t.gross_premium*rate,2),
        auto_calculation_percent=rate,auto_amount=round(t.gross_premium*rate,2),is_custom=false,
        custom_reason=null,customized_at=null
      where id=existing_id and status::text <> 'paid';
    end if;
  end loop;
end $$;

create or replace function public.kover_refresh_clawbacks(p_term_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare t public.policy_terms;
begin
  select * into strict t from public.policy_terms where id=p_term_id;
  if t.policy_status::text <> 'cancelled' or t.gross_refund_amount is null then return; end if;
  if t.gross_refund_amount > coalesce(t.gross_premium,0) then raise exception 'Gross premium refunded cannot exceed current Gross Premium.'; end if;
  insert into public.policy_commission_clawbacks(policy_term_id,commission_id,payee_id,gross_refund_amount,calculation_percent,amount,settlement_status)
  select p_term_id,c.id,c.payee_id,t.gross_refund_amount,c.calculation_percent,
    round(t.gross_refund_amount*coalesce(c.calculation_percent,0),2),'pending'
  from public.commissions c where c.policy_term_id=p_term_id and c.entry_kind is distinct from 'adjustment'
  on conflict(policy_term_id,commission_id) do update set
    gross_refund_amount=excluded.gross_refund_amount,calculation_percent=excluded.calculation_percent,amount=excluded.amount
  where policy_commission_clawbacks.settlement_status='pending';
end $$;

create or replace function public.kover_save_policy_financials(p_term_id uuid,p_changes jsonb,p_commission_decision text default null)
returns void language plpgsql security definer set search_path=public as $$
declare t public.policy_terms; next_row public.policy_terms; gross_delta numeric; total_delta numeric; key text;
begin
  if auth.uid() is null then raise exception 'You must be logged in.'; end if;
  select * into strict t from public.policy_terms where id=p_term_id for update;
  for key in select jsonb_object_keys(p_changes) loop
    if not (key=any(array['gross_premium','total_premium','basic_premium','ncd_amount','service_tax','stamp_duty','total_payable_override','typical_premium_rate','cover_note_number','issue_date','financial_interest','seating_capacity','product_name','cancellation_date','refund_amount','gross_refund_amount','transferred_from_policy_term_id','policy_status','quotation_status','term_stage','split_pattern_id','gross_commission_percent','net_commission_percent'])) then
      raise exception 'Unsupported financial field: %',key;
    end if;
  end loop;
  select coalesce(sum(premium_change),0),coalesce(sum(net_amount),0) into gross_delta,total_delta
    from public.policy_endorsements where policy_term_id=p_term_id;
  next_row:=jsonb_populate_record(t,p_changes);
  if p_changes ? 'gross_premium' then
    if next_row.gross_premium is null and exists(select 1 from public.policy_endorsements where policy_term_id=p_term_id) then
      raise exception 'Original Gross Premium cannot be cleared while endorsements exist.';
    end if;
    next_row.original_gross_premium:=next_row.gross_premium;
    next_row.gross_premium:=next_row.original_gross_premium+gross_delta;
  end if;
  if p_changes ? 'total_premium' then
    if next_row.total_premium is null and exists(select 1 from public.policy_endorsements where policy_term_id=p_term_id) then
      raise exception 'Original Total Payable cannot be cleared while endorsements exist.';
    end if;
    next_row.original_total_premium:=next_row.total_premium;
    next_row.total_premium:=next_row.original_total_premium+total_delta;
  end if;
  if (next_row.gross_premium is distinct from t.gross_premium or next_row.split_pattern_id is distinct from t.split_pattern_id or next_row.gross_commission_percent is distinct from t.gross_commission_percent or next_row.net_commission_percent is distinct from t.net_commission_percent)
    and exists(select 1 from public.commissions where policy_term_id=p_term_id and entry_kind is distinct from 'adjustment')
    and coalesce(p_commission_decision,'') not in ('update','keep') then
    raise exception 'Premium changed. Choose whether to update or keep existing commissions.';
  end if;
  if next_row.policy_status::text='cancelled' and next_row.cancellation_date is null then raise exception 'Cancellation Date is required.'; end if;
  if next_row.gross_premium < 0 or next_row.total_premium < 0 or next_row.seating_capacity < 0 or next_row.basic_premium < 0 or next_row.ncd_amount < 0 or next_row.service_tax < 0 or next_row.stamp_duty < 0 or next_row.refund_amount < 0 or next_row.gross_refund_amount < 0 or next_row.typical_premium_rate < 0 or next_row.typical_premium_rate > 1 then
    raise exception 'Premium breakdown, refunds and seating capacity cannot be negative; typical rate must be 0-100%%.';
  end if;
  update public.policy_terms set
    gross_premium=next_row.gross_premium,total_premium=next_row.total_premium,
    original_gross_premium=next_row.original_gross_premium,original_total_premium=next_row.original_total_premium,
    basic_premium=next_row.basic_premium,ncd_amount=next_row.ncd_amount,service_tax=next_row.service_tax,stamp_duty=next_row.stamp_duty,
    total_payable_override=next_row.total_payable_override,typical_premium_rate=next_row.typical_premium_rate,
    cover_note_number=next_row.cover_note_number,issue_date=next_row.issue_date,financial_interest=next_row.financial_interest,
    seating_capacity=next_row.seating_capacity,product_name=next_row.product_name,cancellation_date=next_row.cancellation_date,
    refund_amount=next_row.refund_amount,gross_refund_amount=next_row.gross_refund_amount,
    transferred_from_policy_term_id=next_row.transferred_from_policy_term_id,
    split_pattern_id=next_row.split_pattern_id,gross_commission_percent=next_row.gross_commission_percent,net_commission_percent=next_row.net_commission_percent,
    policy_status=next_row.policy_status,quotation_status=next_row.quotation_status,term_stage=next_row.term_stage
  where id=p_term_id;
  if p_commission_decision='update' or (not exists(select 1 from public.commissions where policy_term_id=p_term_id and entry_kind is distinct from 'adjustment') and next_row.split_pattern_id is not null) then
    perform public.kover_recalculate_commissions(p_term_id);
  end if;
  perform public.kover_refresh_clawbacks(p_term_id);
end $$;

create or replace function public.kover_save_endorsement(p_term_id uuid,p_endorsement_id uuid,p_values jsonb,p_commission_decision text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare t public.policy_terms; e public.policy_endorsements; result_id uuid; gross_delta numeric; total_delta numeric; previous_gross numeric; previous_endorsement jsonb;
begin
  if auth.uid() is null then raise exception 'You must be logged in.'; end if;
  select * into strict t from public.policy_terms where id=p_term_id for update;
  if coalesce(t.original_gross_premium,t.gross_premium) is null or coalesce(t.original_total_premium,t.total_premium) is null then
    raise exception 'Enter original Gross Premium and Total Payable before adding endorsements.';
  end if;
  if p_endorsement_id is not null then
    select * into strict e from public.policy_endorsements where id=p_endorsement_id and policy_term_id=p_term_id for update;
    if e.settlement_status='settled' and (to_jsonb(e)-array['settlement_status','updated_at']) @> (p_values-'settlement_status') = false then
      raise exception 'This endorsement is settled. Change it to Pending before editing amounts.';
    end if;
  end if;
  if p_endorsement_id is not null then previous_endorsement:=to_jsonb(e); end if;
  e:=jsonb_populate_record(e,p_values);
  if e.issue_date is null or e.effective_date is null or nullif(trim(e.description),'') is null or e.premium_change is null then
    raise exception 'Issue Date, Effective Date, Description and Premium Change are required.';
  end if;
  if e.effective_date < t.effective_date or e.effective_date > t.expiry_date then raise exception 'Endorsement Effective Date must be inside the policy term.'; end if;
  if coalesce(e.settlement_status,'pending') not in ('pending','settled') then raise exception 'Invalid settlement status.'; end if;
  e.net_amount:=coalesce(e.net_amount,round(e.premium_change+coalesce(e.service_tax_change,0),2));
  if p_endorsement_id is null then
    insert into public.policy_endorsements(policy_term_id,endorsement_number,issue_date,effective_date,description,premium_change,service_tax_change,net_amount,settlement_status)
    values(p_term_id,e.endorsement_number,e.issue_date,e.effective_date,e.description,e.premium_change,e.service_tax_change,e.net_amount,coalesce(e.settlement_status,'pending'))
    returning id into result_id;
  else
    update public.policy_endorsements set endorsement_number=e.endorsement_number,issue_date=e.issue_date,effective_date=e.effective_date,
      description=e.description,premium_change=e.premium_change,service_tax_change=e.service_tax_change,net_amount=e.net_amount,settlement_status=e.settlement_status,updated_at=now()
    where id=p_endorsement_id returning id into result_id;
  end if;
  select coalesce(sum(premium_change),0),coalesce(sum(net_amount),0) into gross_delta,total_delta
    from public.policy_endorsements where policy_term_id=p_term_id;
  previous_gross:=t.gross_premium;
  if coalesce(t.original_gross_premium,t.gross_premium,0)+gross_delta < 0 or coalesce(t.original_total_premium,t.total_premium,0)+total_delta < 0 then
    raise exception 'Endorsements cannot reduce the policy premium below zero.';
  end if;
  if previous_gross is distinct from coalesce(t.original_gross_premium,t.gross_premium,0)+gross_delta
    and exists(select 1 from public.commissions where policy_term_id=p_term_id and entry_kind is distinct from 'adjustment')
    and coalesce(p_commission_decision,'') not in ('update','keep') then
    raise exception 'Choose whether to update or keep commissions for this endorsement.';
  end if;
  update public.policy_terms set original_gross_premium=coalesce(t.original_gross_premium,t.gross_premium,0),
    original_total_premium=coalesce(t.original_total_premium,t.total_premium,0),
    gross_premium=coalesce(t.original_gross_premium,t.gross_premium,0)+gross_delta,
    total_premium=coalesce(t.original_total_premium,t.total_premium,0)+total_delta where id=p_term_id;
  insert into public.policy_change_history(policy_term_id,field_name,old_value,new_value)
  values(p_term_id,'endorsement',previous_endorsement,jsonb_build_object('id',result_id,'values',p_values));
  if p_commission_decision='update' then perform public.kover_recalculate_commissions(p_term_id); end if;
  perform public.kover_refresh_clawbacks(p_term_id);
  return result_id;
end $$;

-- Audit every policy-owned field, including newly added metadata and risk details.
create or replace function public.kover_log_policy_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare b jsonb; a jsonb; key text; term uuid;
begin
 if tg_op='UPDATE' then b:=to_jsonb(old); end if;
 a:=to_jsonb(new);
 term:=(case when tg_table_name='policy_terms' then a->>'id' else a->>'policy_term_id' end)::uuid;
 for key in select jsonb_object_keys(a) loop
  if key in ('id','policy_term_id','updated_at','created_at','created_by','updated_by') then continue; end if;
  if b->key is distinct from a->key and not (tg_op='INSERT' and a->key='null'::jsonb) then
   insert into public.policy_change_history(policy_term_id,field_name,old_value,new_value)
   values(term,key,b->key,a->key);
  end if;
 end loop;
 return new;
end $$;
drop trigger if exists kover_motor_change_history on public.motor_policy_details;
create trigger kover_motor_change_history after insert or update on public.motor_policy_details for each row execute function public.kover_log_policy_change();
do $$
declare tab text;
begin
 foreach tab in array array['fire_policy_details','marine_policy_details','travel_policy_details','generic_policy_details'] loop
  execute format('drop trigger if exists kover_risk_change_history on public.%I',tab);
  execute format('create trigger kover_risk_change_history after insert or update on public.%I for each row execute function public.kover_log_policy_change()',tab);
 end loop;
end $$;
-- Shared client/address/vehicle edits are audited against each linked policy.
create or replace function public.kover_log_related_policy_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare b jsonb:=to_jsonb(old); a jsonb:=to_jsonb(new); term uuid; ids uuid[]; key text;
begin
 if tg_table_name='clients' then select array_agg(id) into ids from public.policy_terms where client_id=new.id;
 elsif tg_table_name='client_addresses' then select array_agg(id) into ids from public.policy_terms where client_address_id=new.id;
 else select array_agg(policy_term_id) into ids from public.motor_policy_details where vehicle_id=new.id; end if;
 foreach term in array coalesce(ids,array[]::uuid[]) loop
  for key in select jsonb_object_keys(a) loop
   if key in ('id','client_id','updated_at','created_at','created_by','updated_by') then continue; end if;
   if b->key is distinct from a->key then
    insert into public.policy_change_history(policy_term_id,field_name,old_value,new_value)
    values(term,tg_table_name||'.'||key,b->key,a->key);
   end if;
  end loop;
 end loop;
 return new;
end $$;
do $$
declare tab text;
begin
 foreach tab in array array['clients','client_addresses','vehicles'] loop
  execute format('drop trigger if exists kover_related_change_history on public.%I',tab);
  execute format('create trigger kover_related_change_history after update on public.%I for each row execute function public.kover_log_related_policy_change()',tab);
 end loop;
end $$;
revoke all on function public.kover_log_related_policy_change() from public,anon,authenticated;
revoke all on function public.kover_save_adjustment(uuid,uuid,uuid,numeric,text,text,date),public.kover_delete_adjustment(uuid,uuid),public.kover_commission_paid_date(uuid,date),public.kover_toggle_policy_commissions(uuid),public.kover_confirm_commission_payment(uuid[],date,text) from public,anon;
grant execute on function public.kover_save_adjustment(uuid,uuid,uuid,numeric,text,text,date),public.kover_delete_adjustment(uuid,uuid),public.kover_commission_paid_date(uuid,date),public.kover_toggle_policy_commissions(uuid),public.kover_confirm_commission_payment(uuid[],date,text) to authenticated;
revoke all on function public.kover_log_commission_change(),public.kover_guard_adjustment() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
