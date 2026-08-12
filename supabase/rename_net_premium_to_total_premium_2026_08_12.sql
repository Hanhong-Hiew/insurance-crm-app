-- Rename net premium to total premium - 2026-08-12
--
-- Business meaning:
-- - The old "net_premium" field was actually the total premium payable.
-- - Keep commission logic unchanged; this is a naming/data-model correction.
--
-- Run this in Supabase SQL Editor before deploying the website changes.

begin;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'policy_terms'
      and column_name = 'net_premium'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'policy_terms'
      and column_name = 'total_premium'
  ) then
    alter table public.policy_terms
      rename column net_premium to total_premium;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'main_policy_view'
      and column_name = 'net_premium'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'main_policy_view'
      and column_name = 'total_premium'
  ) then
    alter view public.main_policy_view
      rename column net_premium to total_premium;
  end if;
end $$;

commit;
