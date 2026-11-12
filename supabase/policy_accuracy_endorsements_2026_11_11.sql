-- Kover: additive policy accuracy, endorsements and history.
-- No existing rows are updated/deleted, no columns/views are renamed or dropped.
begin;

alter table public.policy_terms
  add column if not exists basic_premium numeric(14,2),
  add column if not exists ncd_amount numeric(14,2),
  add column if not exists service_tax numeric(14,2),
  add column if not exists stamp_duty numeric(14,2),
  add column if not exists total_payable_override boolean,
  add column if not exists typical_premium_rate numeric(9,6),
  add column if not exists cover_note_number text,
  add column if not exists issue_date date,
  add column if not exists financial_interest text,
  add column if not exists seating_capacity integer,
  add column if not exists product_name text,
  add column if not exists original_gross_premium numeric(14,2),
  add column if not exists original_total_premium numeric(14,2),
  add column if not exists cancellation_date date,
  add column if not exists refund_amount numeric(14,2),
  add column if not exists gross_refund_amount numeric(14,2),
  add column if not exists transferred_from_policy_term_id uuid references public.policy_terms(id);

alter table public.insurance_types add column if not exists typical_premium_rate numeric(9,6);

create table if not exists public.policy_endorsements (
  id uuid primary key default gen_random_uuid(),
  policy_term_id uuid references public.policy_terms(id) on delete restrict,
  endorsement_number text,
  issue_date date,
  effective_date date,
  description text,
  premium_change numeric(14,2),
  service_tax_change numeric(14,2),
  net_amount numeric(14,2),
  settlement_status text check (settlement_status in ('pending','settled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.policy_change_history (
  id uuid primary key default gen_random_uuid(),
  policy_term_id uuid references public.policy_terms(id) on delete restrict,
  field_name text,
  old_value jsonb,
  new_value jsonb,
  changed_at timestamptz default now(),
  changed_by uuid default auth.uid()
);

create table if not exists public.policy_commission_clawbacks (
  id uuid primary key default gen_random_uuid(),
  policy_term_id uuid references public.policy_terms(id) on delete restrict,
  commission_id uuid references public.commissions(id) on delete restrict,
  payee_id uuid references public.commission_payees(id),
  gross_refund_amount numeric(14,2),
  calculation_percent numeric(12,8),
  amount numeric(14,2),
  settlement_status text check (settlement_status in ('pending','settled')),
  created_at timestamptz default now(),
  unique (policy_term_id, commission_id)
);

create index if not exists policy_endorsements_term_idx on public.policy_endorsements(policy_term_id);
create index if not exists policy_change_history_term_idx on public.policy_change_history(policy_term_id, changed_at desc);
create index if not exists policy_terms_issue_date_idx on public.policy_terms(issue_date);
create index if not exists policy_terms_cover_note_idx on public.policy_terms(lower(cover_note_number));

alter table public.policy_endorsements enable row level security;
alter table public.policy_change_history enable row level security;
alter table public.policy_commission_clawbacks enable row level security;

-- Follow the app's existing authenticated agency access model.
drop policy if exists agency_read_endorsements on public.policy_endorsements;
create policy agency_read_endorsements on public.policy_endorsements for select to authenticated using (true);
drop policy if exists agency_read_policy_history on public.policy_change_history;
create policy agency_read_policy_history on public.policy_change_history for select to authenticated using (true);
drop policy if exists agency_read_clawbacks on public.policy_commission_clawbacks;
create policy agency_read_clawbacks on public.policy_commission_clawbacks for select to authenticated using (true);
grant select on public.policy_endorsements, public.policy_change_history, public.policy_commission_clawbacks to authenticated;
revoke insert, update, delete on public.policy_endorsements, public.policy_change_history, public.policy_commission_clawbacks from anon, authenticated;

create or replace function public.kover_log_policy_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare key text; before_row jsonb; after_row jsonb; term_id uuid;
begin
  before_row := to_jsonb(old); after_row := to_jsonb(new);
  term_id := (case when tg_table_name = 'motor_policy_details' then after_row->>'policy_term_id' else after_row->>'id' end)::uuid;
  foreach key in array case when tg_table_name = 'motor_policy_details' then array['ncd']
    else array['gross_premium','total_premium','basic_premium','ncd_amount','service_tax','stamp_duty','policy_number','cover_note_number','policy_status','cancellation_date','refund_amount','gross_refund_amount'] end
  loop
    if before_row->key is distinct from after_row->key then
      insert into public.policy_change_history(policy_term_id,field_name,old_value,new_value)
      values (term_id,key,before_row->key,after_row->key);
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists kover_policy_change_history on public.policy_terms;
create trigger kover_policy_change_history after update on public.policy_terms
for each row execute function public.kover_log_policy_change();
drop trigger if exists kover_motor_change_history on public.motor_policy_details;
create trigger kover_motor_change_history after update on public.motor_policy_details
for each row execute function public.kover_log_policy_change();

-- Internal helper: called inside the same transaction as the premium change.
-- Paid rows, payment batches and statement snapshots are never rewritten.
create or replace function public.kover_recalculate_commissions(p_term_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t public.policy_terms; r record; rate numeric; fixed_rate numeric; equal_count integer; existing_id uuid;
begin
  select * into strict t from public.policy_terms where id=p_term_id for update;
  perform 1 from public.commissions where policy_term_id=p_term_id for update;
  if t.split_pattern_id is null or t.gross_premium is null then return; end if;
  if not exists(select 1 from public.commission_split_rules where split_pattern_id=t.split_pattern_id) then
    raise exception 'Selected split pattern has no commission rules.';
  end if;
  select coalesce(sum(fixed_percent) filter(where rule_type::text='fixed_percent_of_gross'),0),
    greatest(count(*) filter(where rule_type::text='equal_net_share'),1)
    into fixed_rate,equal_count from public.commission_split_rules where split_pattern_id=t.split_pattern_id;
  if exists(select 1 from public.commissions c where c.policy_term_id=p_term_id and c.status::text <> 'paid'
    and not exists(select 1 from public.commission_split_rules sr where sr.split_pattern_id=t.split_pattern_id and sr.payee_id=c.payee_id)) then
    raise exception 'Existing unpaid payees differ from this split. Keep existing commissions or settle the old allocation before changing the split.';
  end if;
  for r in select * from public.commission_split_rules where split_pattern_id=t.split_pattern_id order by sort_order loop
    if exists(select 1 from public.commissions where policy_term_id=p_term_id and payee_id=r.payee_id and status::text='paid') then continue; end if;
    rate := case r.rule_type::text
      when 'gross_commission_share' then coalesce(t.gross_commission_percent,0)*coalesce(r.share_percent,0)
      when 'net_commission_share' then coalesce(t.net_commission_percent,0)*coalesce(r.share_percent,0)
      when 'fixed_percent_of_gross' then coalesce(r.fixed_percent,0)
      when 'remaining_net_after_fixed_percent' then greatest(coalesce(t.net_commission_percent,0)-fixed_rate,0)
      when 'equal_net_share' then coalesce(t.net_commission_percent,0)/equal_count
      else null end;
    if rate is null then raise exception 'Unsupported commission rule: %',r.rule_type; end if;
    if (select count(*) from public.commissions where policy_term_id=p_term_id and payee_id=r.payee_id) > 1 then
      raise exception 'Multiple commission rows exist for one payee. Review them before recalculating.';
    end if;
    select id into existing_id from public.commissions where policy_term_id=p_term_id and payee_id=r.payee_id;
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
  from public.commissions c where c.policy_term_id=p_term_id
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
    and exists(select 1 from public.commissions where policy_term_id=p_term_id)
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
  if p_commission_decision='update' or (not exists(select 1 from public.commissions where policy_term_id=p_term_id) and next_row.split_pattern_id is not null) then
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
    and exists(select 1 from public.commissions where policy_term_id=p_term_id)
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

-- Full-table duplicate check; no top-50 or page limit.
create or replace function public.kover_policy_duplicate_warnings(p_term_id uuid,p_plate text,p_start date,p_end date,p_policy_number text,p_cover_note text)
returns table(policy_term_id uuid,client_name text,policy_number text,cover_note_number text,effective_date date,expiry_date date,reason text)
language sql stable security invoker set search_path=public as $$
 select t.id,c.client_name,t.policy_number,t.cover_note_number,t.effective_date,t.expiry_date,
 concat_ws('; ',
   case when nullif(lower(trim(p_policy_number)),'') not in ('n/a','na','-') and
     (lower(trim(t.policy_number))=lower(trim(p_policy_number)) or lower(trim(t.cover_note_number))=lower(trim(p_policy_number))) then 'Same policy number' end,
   case when nullif(lower(trim(p_cover_note)),'') not in ('n/a','na','-') and
     (lower(trim(t.cover_note_number))=lower(trim(p_cover_note)) or lower(trim(t.policy_number))=lower(trim(p_cover_note))) then 'Same cover note number' end,
   case when nullif(regexp_replace(upper(p_plate),'[^A-Z0-9]','','g'),'') is not null and
     exists(select 1 from public.motor_policy_details m left join public.vehicles v on v.id=m.vehicle_id
       where m.policy_term_id=t.id and regexp_replace(upper(coalesce(nullif(trim(m.vehicle_no_snapshot),''),v.vehicle_no)),'[^A-Z0-9]','','g')=regexp_replace(upper(p_plate),'[^A-Z0-9]','','g'))
     and t.effective_date<=p_end and t.expiry_date>=p_start then 'Same plate with overlapping period' end)
 from public.policy_terms t join public.clients c on c.id=t.client_id
 where (p_term_id is null or t.id<>p_term_id) and (
   (nullif(lower(trim(p_policy_number)),'') not in ('n/a','na','-') and (lower(trim(t.policy_number))=lower(trim(p_policy_number)) or lower(trim(t.cover_note_number))=lower(trim(p_policy_number)))) or
   (nullif(lower(trim(p_cover_note)),'') not in ('n/a','na','-') and (lower(trim(t.cover_note_number))=lower(trim(p_cover_note)) or lower(trim(t.policy_number))=lower(trim(p_cover_note)))) or
   (nullif(regexp_replace(upper(p_plate),'[^A-Z0-9]','','g'),'') is not null and t.effective_date<=p_end and t.expiry_date>=p_start and exists(
     select 1 from public.motor_policy_details m left join public.vehicles v on v.id=m.vehicle_id where m.policy_term_id=t.id
     and regexp_replace(upper(coalesce(nullif(trim(m.vehicle_no_snapshot),''),v.vehicle_no)),'[^A-Z0-9]','','g')=regexp_replace(upper(p_plate),'[^A-Z0-9]','','g')))
 );
$$;

revoke all on function public.kover_recalculate_commissions(uuid),public.kover_refresh_clawbacks(uuid),public.kover_log_policy_change() from public,anon,authenticated;
revoke all on function public.kover_save_policy_financials(uuid,jsonb,text),public.kover_save_endorsement(uuid,uuid,jsonb,text),public.kover_policy_duplicate_warnings(uuid,text,date,date,text,text) from public,anon;
grant execute on function public.kover_save_policy_financials(uuid,jsonb,text),public.kover_save_endorsement(uuid,uuid,jsonb,text),public.kover_policy_duplicate_warnings(uuid,text,date,date,text,text) to authenticated;

create or replace function public.kover_motor_transfer_candidates(p_plate text,p_term_id uuid default null)
returns table(id uuid,client_name text,policy_number text,effective_date date)
language sql stable security invoker set search_path=public as $$
 select t.id,c.client_name,t.policy_number,t.effective_date from public.policy_terms t
 join public.clients c on c.id=t.client_id
 where (p_term_id is null or t.id<>p_term_id) and exists(
   select 1 from public.motor_policy_details m left join public.vehicles v on v.id=m.vehicle_id
   where m.policy_term_id=t.id and nullif(regexp_replace(upper(p_plate),'[^A-Z0-9]','','g'),'') is not null
   and regexp_replace(upper(coalesce(nullif(trim(m.vehicle_no_snapshot),''),v.vehicle_no)),'[^A-Z0-9]','','g')=regexp_replace(upper(p_plate),'[^A-Z0-9]','','g')
 ) order by t.effective_date desc nulls last;
$$;
revoke all on function public.kover_motor_transfer_candidates(text,uuid) from public,anon;
grant execute on function public.kover_motor_transfer_candidates(text,uuid) to authenticated;

-- Append fields without changing existing view column names, order or values.
do $$
declare definition text; additions text; col text;
begin
  if to_regclass('public.main_policy_view') is not null then
    definition:=regexp_replace(pg_get_viewdef('public.main_policy_view'::regclass,true),';[[:space:]]*$','');
    additions:='';
    foreach col in array array['issue_date','cover_note_number','product_name','basic_premium','ncd_amount','service_tax','stamp_duty','original_gross_premium','original_total_premium','financial_interest','seating_capacity','cancellation_date','refund_amount','gross_refund_amount'] loop
      if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='main_policy_view' and column_name=col) then
        additions:=additions || format(', accuracy.%I',col);
      end if;
    end loop;
    if additions<>'' then
      execute format('create or replace view public.main_policy_view with (security_invoker=true) as select legacy.* %s from (%s) legacy join public.policy_terms accuracy on accuracy.id=legacy.policy_term_id',additions,definition);
    end if;
  end if;
end $$;

notify pgrst,'reload schema';
commit;
