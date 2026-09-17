-- Marine declaration edit/delete support - 2026-09-17
-- Run this in Supabase SQL Editor after the monthly declaration cleanup SQL.
-- Purpose:
-- - make one declaration per marine open cover per month a database rule
-- - merge accidental duplicate declaration rows before adding the rule

with ranked as (
  select
    *,
    row_number() over (
      partition by open_cover_id, billing_month
      order by created_at asc, id asc
    ) as row_no
  from public.marine_declarations
),
aggregated as (
  select
    open_cover_id,
    billing_month,
    sum(coalesce(certificate_count, 0)) as certificate_count,
    sum(coalesce(gross_premium, 0)) as gross_premium,
    sum(coalesce(total_premium, 0)) as total_premium,
    nullif(sum(coalesce(sum_insured, 0)), 0) as sum_insured,
    string_agg(nullif(notes, ''), E'\n' order by created_at asc, id asc) as notes
  from public.marine_declarations
  group by open_cover_id, billing_month
  having count(*) > 1
),
merged as (
  select
    ranked.id as keep_id,
    aggregated.certificate_count,
    aggregated.gross_premium,
    aggregated.total_premium,
    aggregated.sum_insured,
    aggregated.notes
  from aggregated
  join ranked
    on ranked.open_cover_id = aggregated.open_cover_id
   and ranked.billing_month = aggregated.billing_month
   and ranked.row_no = 1
)
update public.marine_declarations declaration
set
  certificate_count = merged.certificate_count,
  gross_premium = merged.gross_premium,
  total_premium = merged.total_premium,
  sum_insured = merged.sum_insured,
  notes = coalesce(merged.notes, declaration.notes),
  updated_at = now()
from merged
where declaration.id = merged.keep_id;

with ranked as (
  select
    id,
    row_number() over (
      partition by open_cover_id, billing_month
      order by created_at asc, id asc
    ) as row_no
  from public.marine_declarations
)
delete from public.marine_declarations declaration
using ranked
where declaration.id = ranked.id
  and ranked.row_no > 1;

alter table public.marine_declarations
drop constraint if exists marine_declarations_open_cover_billing_month_key;

alter table public.marine_declarations
drop constraint if exists marine_declarations_open_cover_id_billing_month_key;

alter table public.marine_declarations
add constraint marine_declarations_open_cover_billing_month_key
unique (open_cover_id, billing_month);
