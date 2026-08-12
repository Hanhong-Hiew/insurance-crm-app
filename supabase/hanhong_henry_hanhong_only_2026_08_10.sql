-- Fix H/HENRY split so only Hanhong is payable - 2026-08-10
--
-- Business logic:
-- - H/HENRY is only used to calculate Hanhong's commission.
-- - Henry is not an internal payee/agent.
-- - Hanhong gets 50% of the gross commission rate.
-- - No Henry commission row should be generated.
--
-- Existing paid or batched Henry rows are not deleted for audit safety.
-- Existing unpaid/unbatched Henry rows created by mistake are removed.

begin;

do $$
declare
  hanhong_payee_id uuid;
  henry_payee_id uuid;
  split_pattern_id_value uuid;
begin
  select id
  into hanhong_payee_id
  from public.commission_payees
  where lower(trim(name)) = 'hanhong'
  limit 1;

  if hanhong_payee_id is null then
    insert into public.commission_payees (name, active, notes)
    values ('Hanhong', true, 'Payable commission agent')
    returning id into hanhong_payee_id;
  else
    update public.commission_payees
    set active = true
    where id = hanhong_payee_id;
  end if;

  select id
  into henry_payee_id
  from public.commission_payees
  where lower(trim(name)) = 'henry'
  limit 1;

  select id
  into split_pattern_id_value
  from public.commission_split_patterns
  where upper(trim(code)) in ('H/HENRY', 'HH/HENRY')
     or lower(trim(name)) in ('hanhong / henry', 'hh / henry', 'hh/henry')
  limit 1;

  if split_pattern_id_value is null then
    insert into public.commission_split_patterns (code, name, active, notes)
    values (
      'H/HENRY',
      'Hanhong / Henry',
      true,
      'Hanhong 50% of gross commission rate. Henry is not payable.'
    )
    returning id into split_pattern_id_value;
  else
    update public.commission_split_patterns
    set
      code = 'H/HENRY',
      name = 'Hanhong / Henry',
      active = true,
      notes = 'Hanhong 50% of gross commission rate. Henry is not payable.'
    where id = split_pattern_id_value;
  end if;

  if henry_payee_id is not null then
    delete from public.commissions
    where split_pattern_id = split_pattern_id_value
      and payee_id = henry_payee_id
      and payment_batch_id is null
      and status in ('unpaid', 'partial');

    update public.commission_payees
    set
      active = false,
      notes = 'Not payable. H/HENRY split tracks Hanhong only.'
    where id = henry_payee_id;
  end if;

  delete from public.commission_split_rules
  where split_pattern_id = split_pattern_id_value;

  insert into public.commission_split_rules (
    split_pattern_id,
    payee_id,
    rule_type,
    share_percent,
    fixed_percent,
    subtract_percent,
    sort_order
  )
  values (
    split_pattern_id_value,
    hanhong_payee_id,
    'gross_commission_share',
    0.5,
    null,
    null,
    1
  );
end $$;

commit;
