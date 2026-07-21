-- Allow logged-in users to edit Settings tables - 2026-07-21
-- Run this once in Supabase SQL Editor.

alter table public.insurance_types enable row level security;
alter table public.insurers enable row level security;
alter table public.commission_rate_settings enable row level security;
alter table public.commission_payees enable row level security;
alter table public.commission_split_patterns enable row level security;
alter table public.commission_split_rules enable row level security;

drop policy if exists "authenticated manage insurance_types" on public.insurance_types;
create policy "authenticated manage insurance_types"
on public.insurance_types for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manage insurers" on public.insurers;
create policy "authenticated manage insurers"
on public.insurers for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manage commission_rate_settings" on public.commission_rate_settings;
create policy "authenticated manage commission_rate_settings"
on public.commission_rate_settings for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manage commission_payees" on public.commission_payees;
create policy "authenticated manage commission_payees"
on public.commission_payees for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manage commission_split_patterns" on public.commission_split_patterns;
create policy "authenticated manage commission_split_patterns"
on public.commission_split_patterns for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manage commission_split_rules" on public.commission_split_rules;
create policy "authenticated manage commission_split_rules"
on public.commission_split_rules for all to authenticated using (true) with check (true);
