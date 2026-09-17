-- Marine open cover lightweight workflow - 2026-08-24
-- Run once in Supabase SQL Editor.
-- Design:
-- - policy_terms remains the annual master open cover
-- - marine_declarations stores lightweight declaration/certificate rows
-- - marine_monthly_billings groups declarations by month for premium collection
-- - marine_billing_commissions stores monthly commission rows

do $$
begin
  if exists (
    select 1
    from public.insurance_types
    where code = 'marine_open_cover'
  ) then
    update public.insurance_types
    set
      active = true,
      name = 'Marine Open Cover',
      notes = 'Monthly declaration marine workflow. Use Marine Insurance for one-off marine policies.'
    where code = 'marine_open_cover';
  else
    insert into public.insurance_types (code, name, active, notes)
    values (
      'marine_open_cover',
      'Marine Open Cover',
      true,
      'Monthly declaration marine workflow. Use Marine Insurance for one-off marine policies.'
    );
  end if;
end $$;

insert into public.commission_rate_settings (
  insurance_type_id,
  gross_commission_percent,
  net_commission_percent,
  active,
  notes
)
select
  marine_open_cover.id,
  coalesce(marine_rate.gross_commission_percent, 0.15),
  coalesce(marine_rate.net_commission_percent, 0.11),
  true,
  'Default Marine Open Cover rate. Edit in Settings if needed.'
from public.insurance_types marine_open_cover
left join public.insurance_types marine
  on marine.code in ('marine_insurance', 'marine')
  or lower(marine.name) = 'marine insurance'
left join public.commission_rate_settings marine_rate
  on marine_rate.insurance_type_id = marine.id
  and marine_rate.active = true
where marine_open_cover.code = 'marine_open_cover'
  and not exists (
    select 1
    from public.commission_rate_settings existing
    where existing.insurance_type_id = marine_open_cover.id
  )
limit 1;

create table if not exists public.marine_open_covers (
  id uuid primary key default gen_random_uuid(),
  policy_term_id uuid not null references public.policy_terms(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'closed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (policy_term_id)
);

create table if not exists public.marine_monthly_billings (
  id uuid primary key default gen_random_uuid(),
  open_cover_id uuid not null references public.marine_open_covers(id) on delete cascade,
  billing_month date not null,
  gross_premium_total numeric(14, 2) not null default 0,
  total_premium_total numeric(14, 2) not null default 0,
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'partial', 'paid')),
  paid_date date,
  commission_status text not null default 'unpaid'
    check (commission_status in ('unpaid', 'partial', 'paid')),
  commission_paid_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (open_cover_id, billing_month)
);

create table if not exists public.marine_declarations (
  id uuid primary key default gen_random_uuid(),
  open_cover_id uuid not null references public.marine_open_covers(id) on delete cascade,
  monthly_billing_id uuid references public.marine_monthly_billings(id) on delete set null,
  certificate_count integer not null default 0
    check (certificate_count >= 0),
  sum_insured numeric(14, 2),
  gross_premium numeric(14, 2) not null default 0,
  total_premium numeric(14, 2) not null default 0,
  billing_month date not null,
  billing_status text not null default 'unbilled'
    check (billing_status in ('unbilled', 'billed', 'paid')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (open_cover_id, billing_month)
);

create index if not exists marine_declarations_open_cover_month_idx
on public.marine_declarations(open_cover_id, billing_month);

create table if not exists public.marine_billing_commissions (
  id uuid primary key default gen_random_uuid(),
  billing_id uuid not null references public.marine_monthly_billings(id) on delete cascade,
  payee_id uuid references public.commission_payees(id),
  payee_name_snapshot text,
  calculation_percent numeric(12, 8) not null default 0,
  amount numeric(14, 2) not null default 0,
  unpaid_amount numeric(14, 2) not null default 0,
  status text not null default 'unpaid'
    check (status in ('unpaid', 'partial', 'paid')),
  paid_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marine_billing_commissions_billing_idx
on public.marine_billing_commissions(billing_id);

alter table public.marine_open_covers enable row level security;
alter table public.marine_declarations enable row level security;
alter table public.marine_monthly_billings enable row level security;
alter table public.marine_billing_commissions enable row level security;

drop policy if exists "authenticated manage marine_open_covers" on public.marine_open_covers;
create policy "authenticated manage marine_open_covers"
on public.marine_open_covers for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manage marine_declarations" on public.marine_declarations;
create policy "authenticated manage marine_declarations"
on public.marine_declarations for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manage marine_monthly_billings" on public.marine_monthly_billings;
create policy "authenticated manage marine_monthly_billings"
on public.marine_monthly_billings for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manage marine_billing_commissions" on public.marine_billing_commissions;
create policy "authenticated manage marine_billing_commissions"
on public.marine_billing_commissions for all to authenticated using (true) with check (true);
