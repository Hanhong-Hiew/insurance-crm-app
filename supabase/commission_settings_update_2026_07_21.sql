-- Commission settings and payment statement update - 2026-07-21
-- Run this in Supabase SQL Editor before deploying the related website changes.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'commission_payment_status') then
    create type public.commission_payment_status as enum ('draft', 'paid', 'cancelled');
  end if;
end $$;

alter table public.clients
add column if not exists address text;

alter table public.commissions
add column if not exists auto_amount numeric(14, 2) check (auto_amount is null or auto_amount >= 0),
add column if not exists auto_calculation_percent numeric(7, 6) check (
  auto_calculation_percent is null
  or (auto_calculation_percent >= 0 and auto_calculation_percent <= 1)
),
add column if not exists is_custom boolean not null default false,
add column if not exists custom_reason text,
add column if not exists customized_at timestamptz,
add column if not exists payment_batch_id uuid;

create table if not exists public.commission_payment_batches (
  id uuid primary key default gen_random_uuid(),
  statement_no text not null unique,
  payee_id uuid not null references public.commission_payees(id) on delete restrict,
  statement_date date not null default current_date,
  paid_date date,
  total_amount numeric(14, 2) not null default 0 check (total_amount >= 0),
  status public.commission_payment_status not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'paid' and paid_date is not null)
    or
    (status <> 'paid')
  )
);

create table if not exists public.commission_payment_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.commission_payment_batches(id) on delete cascade,
  commission_id uuid not null references public.commissions(id) on delete restrict,
  amount_payable numeric(14, 2) not null check (amount_payable >= 0),
  client_name_snapshot text,
  policy_number_snapshot text,
  insurance_type_snapshot text,
  insurer_name_snapshot text,
  effective_date_snapshot date,
  expiry_date_snapshot date,
  gross_premium_snapshot numeric(14, 2),
  commission_percent_snapshot numeric(7, 6),
  created_at timestamptz not null default now(),
  unique (batch_id, commission_id)
);

alter table public.commission_payment_items
add column if not exists insurer_name_snapshot text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'commissions_payment_batch_id_fkey'
  ) then
    alter table public.commissions
      add constraint commissions_payment_batch_id_fkey
      foreign key (payment_batch_id)
      references public.commission_payment_batches(id)
      on delete set null;
  end if;
end $$;

create index if not exists commissions_payment_batch_idx
on public.commissions (payment_batch_id);

create index if not exists commission_payment_batches_payee_idx
on public.commission_payment_batches (payee_id);

create index if not exists commission_payment_batches_status_idx
on public.commission_payment_batches (status);

create index if not exists commission_payment_items_batch_idx
on public.commission_payment_items (batch_id);

create index if not exists commission_payment_items_commission_idx
on public.commission_payment_items (commission_id);

alter table public.commission_payment_batches enable row level security;
alter table public.commission_payment_items enable row level security;

drop policy if exists "authenticated manage commission_payment_batches" on public.commission_payment_batches;
create policy "authenticated manage commission_payment_batches"
on public.commission_payment_batches for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manage commission_payment_items" on public.commission_payment_items;
create policy "authenticated manage commission_payment_items"
on public.commission_payment_items for all to authenticated using (true) with check (true);

drop trigger if exists set_commission_payment_batches_updated_at on public.commission_payment_batches;
create trigger set_commission_payment_batches_updated_at
before update on public.commission_payment_batches
for each row execute function public.set_updated_at();

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
