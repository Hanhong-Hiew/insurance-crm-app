-- Add insurer to commission payment statement snapshots - 2026-07-21
-- Run this once in Supabase SQL Editor if commission payment tables already exist.

alter table public.commission_payment_items
add column if not exists insurer_name_snapshot text;

drop view if exists public.commission_payment_statement_view;
create or replace view public.commission_payment_statement_view as
select
  cpb.id as batch_id,
  cpb.statement_no,
  cpb.statement_date,
  cpb.paid_date,
  cpb.total_amount,
  cpb.status as statement_status,
  cpb.notes,
  cp.id as payee_id,
  cp.name as payee_name,
  cpi.id as item_id,
  cpi.commission_id,
  cpi.amount_payable,
  cpi.client_name_snapshot,
  cpi.policy_number_snapshot,
  cpi.insurance_type_snapshot,
  cpi.insurer_name_snapshot,
  cpi.effective_date_snapshot,
  cpi.expiry_date_snapshot,
  cpi.gross_premium_snapshot,
  cpi.commission_percent_snapshot
from public.commission_payment_batches cpb
join public.commission_payees cp on cp.id = cpb.payee_id
left join public.commission_payment_items cpi on cpi.batch_id = cpb.id;

drop view if exists public.unpaid_commission_view;
create or replace view public.unpaid_commission_view as
select
  cm.id as commission_id,
  pt.id as policy_term_id,
  c.client_name,
  pt.policy_number,
  it.name as insurance_type,
  ins.insurer_name,
  cp.name as payee_name,
  cm.calculation_percent,
  cm.amount,
  cm.paid_date,
  cm.unpaid_amount,
  cm.status,
  cm.is_custom,
  cm.custom_reason,
  cpb.statement_no,
  pt.effective_date,
  pt.expiry_date
from public.commissions cm
join public.policy_terms pt on pt.id = cm.policy_term_id
join public.clients c on c.id = pt.client_id
join public.insurance_types it on it.id = pt.insurance_type_id
join public.insurers ins on ins.id = pt.insurer_id
join public.commission_payees cp on cp.id = cm.payee_id
left join public.commission_payment_batches cpb on cpb.id = cm.payment_batch_id
where cm.status in ('unpaid', 'partial')
order by pt.expiry_date asc nulls last, cp.name asc;
