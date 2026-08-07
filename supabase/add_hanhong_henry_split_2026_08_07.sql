-- Add Hanhong / Henry commission split - 2026-08-07
-- Run this once in Supabase SQL Editor.
--
-- Split code: H/HENRY
-- Logic: Hanhong 50% and Henry 50% of the gross commission rate.
-- Example: if Motor gross commission rate is 10%, Hanhong gets 5%
-- and Henry gets 5%, both calculated from gross premium.

do $$
declare
  rule_type_schema text;
  rule_type_name text;
  rule_type_is_enum boolean;
  check_constraint_name text;
begin
  select n.nspname, t.typname, t.typtype = 'e'
  into rule_type_schema, rule_type_name, rule_type_is_enum
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace cn on cn.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  join pg_namespace n on n.oid = t.typnamespace
  where cn.nspname = 'public'
    and c.relname = 'commission_split_rules'
    and a.attname = 'rule_type'
    and not a.attisdropped;

  if rule_type_is_enum then
    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = rule_type_schema
        and t.typname = rule_type_name
        and e.enumlabel = 'gross_commission_share'
    ) then
      execute format(
        'alter type %I.%I add value %L',
        rule_type_schema,
        rule_type_name,
        'gross_commission_share'
      );
    end if;
  end if;

  for check_constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.commission_split_rules'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%rule_type%'
  loop
    execute format(
      'alter table public.commission_split_rules drop constraint %I',
      check_constraint_name
    );
  end loop;

  alter table public.commission_split_rules
  add constraint commission_split_rules_rule_type_check
  check (
    rule_type in (
      'gross_commission_share',
      'net_commission_share',
      'fixed_percent_of_gross',
      'remaining_net_after_fixed_percent',
      'equal_net_share'
    )
  );
exception
  when duplicate_object then
    null;
end $$;

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
    values ('Hanhong', true, 'Auto-created for H/HENRY split')
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

  if henry_payee_id is null then
    insert into public.commission_payees (name, active, notes)
    values ('Henry', true, 'Auto-created for H/HENRY split')
    returning id into henry_payee_id;
  else
    update public.commission_payees
    set active = true
    where id = henry_payee_id;
  end if;

  select id
  into split_pattern_id_value
  from public.commission_split_patterns
  where upper(trim(code)) = 'H/HENRY'
     or lower(trim(name)) = 'hanhong / henry'
  limit 1;

  if split_pattern_id_value is null then
    insert into public.commission_split_patterns (code, name, active, notes)
    values (
      'H/HENRY',
      'Hanhong / Henry',
      true,
      'Hanhong 50%, Henry 50% of gross commission rate'
    )
    returning id into split_pattern_id_value;
  else
    update public.commission_split_patterns
    set
      code = 'H/HENRY',
      name = 'Hanhong / Henry',
      active = true,
      notes = 'Hanhong 50%, Henry 50% of gross commission rate'
    where id = split_pattern_id_value;
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
  values
    (
      split_pattern_id_value,
      hanhong_payee_id,
      'gross_commission_share',
      0.5,
      null,
      null,
      1
    ),
    (
      split_pattern_id_value,
      henry_payee_id,
      'gross_commission_share',
      0.5,
      null,
      null,
      2
    );
end $$;
