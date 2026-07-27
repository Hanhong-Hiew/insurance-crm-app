-- Client saved addresses update - 2026-07-27
-- Run this once in Supabase SQL Editor before deploying the related website changes.

create table if not exists public.client_addresses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  address_label text,
  address text not null,
  is_default boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.policy_terms
add column if not exists client_address_id uuid references public.client_addresses(id) on delete set null;

create index if not exists client_addresses_client_idx
on public.client_addresses (client_id);

create index if not exists client_addresses_default_idx
on public.client_addresses (client_id, is_default);

create index if not exists policy_terms_client_address_idx
on public.policy_terms (client_address_id);

alter table public.client_addresses enable row level security;

drop policy if exists "authenticated manage client_addresses" on public.client_addresses;
create policy "authenticated manage client_addresses"
on public.client_addresses for all to authenticated using (true) with check (true);

drop trigger if exists set_client_addresses_updated_at on public.client_addresses;
create trigger set_client_addresses_updated_at
before update on public.client_addresses
for each row execute function public.set_updated_at();

insert into public.client_addresses (client_id, address_label, address, is_default)
select c.id, 'Main', c.address, true
from public.clients c
where c.address is not null
  and btrim(c.address) <> ''
  and not exists (
    select 1
    from public.client_addresses ca
    where ca.client_id = c.id
      and ca.address = c.address
  );

with first_addresses as (
  select distinct on (client_id)
    id,
    client_id
  from public.client_addresses
  order by client_id, is_default desc, created_at asc
)
update public.policy_terms pt
set client_address_id = fa.id
from first_addresses fa
where pt.client_id = fa.client_id
  and pt.client_address_id is null;

notify pgrst, 'reload schema';
