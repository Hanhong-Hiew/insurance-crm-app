-- Replace client code usage with optional referral source - 2026-07-21
-- Run this once in Supabase SQL Editor.

alter table public.clients
add column if not exists referral text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clients'
      and column_name = 'client_code'
  ) then
    update public.clients
    set referral = client_code
    where referral is null
      and client_code is not null
      and client_code <> '';
  end if;
end $$;

create index if not exists clients_referral_idx on public.clients (referral);
