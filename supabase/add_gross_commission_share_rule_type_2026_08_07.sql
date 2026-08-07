-- Step 1: Add gross commission split rule type - 2026-08-07
--
-- Run this SQL by itself in Supabase SQL Editor first.
-- Do not run it together with the H/HENRY split SQL.
--
-- Reason: PostgreSQL requires a new enum value to be committed before it can be
-- used in constraints or inserted into rows.

do $$
declare
  rule_type_schema text;
  rule_type_name text;
  rule_type_is_enum boolean;
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
end $$;
