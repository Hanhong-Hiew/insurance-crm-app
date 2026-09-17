-- Marine monthly declaration cleanup - 2026-09-17
-- Run this in Supabase SQL Editor before deploying the related website changes.
-- Changes:
-- - use billing_month as the declaration period
-- - replace certificate_no with certificate_count
-- - remove vessel and goods_description from marine open cover declarations

alter table public.marine_declarations
add column if not exists certificate_count integer default 0;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'marine_declarations'
      and column_name = 'certificate_no'
  ) then
    update public.marine_declarations
    set certificate_count = 1
    where coalesce(certificate_count, 0) = 0
      and certificate_no is not null;
  end if;
end $$;

update public.marine_declarations
set certificate_count = 0
where certificate_count is null;

alter table public.marine_declarations
alter column certificate_count set default 0,
alter column certificate_count set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'marine_declarations_certificate_count_check'
  ) then
    alter table public.marine_declarations
      add constraint marine_declarations_certificate_count_check
      check (certificate_count >= 0);
  end if;
end $$;

alter table public.marine_declarations
drop column if exists declaration_date,
drop column if exists certificate_no,
drop column if exists vessel,
drop column if exists goods_description;

create index if not exists marine_declarations_open_cover_month_idx
on public.marine_declarations(open_cover_id, billing_month);
