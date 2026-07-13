import { ArrowLeft, Settings } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";

type InsuranceType = {
  id: string;
  code: string | null;
  name: string | null;
  active: boolean | null;
};

type Insurer = {
  id: string;
  insurer_name: string | null;
  short_name: string | null;
  active: boolean | null;
};

type CommissionRate = {
  id: string;
  insurance_type_id: string | null;
  gross_commission_percent: number | string | null;
  net_commission_percent: number | string | null;
  active: boolean | null;
};

type SplitPattern = {
  id: string;
  code: string | null;
  name: string | null;
  active: boolean | null;
};

function percent(value: number | string | null) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric === 0) return "-";
  return `${(numeric * 100).toFixed(0)}%`;
}

function clean(value: string | null | undefined) {
  return value || "-";
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageShell title="Settings">Loading...</PageShell>}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData?.claims) {
    redirect("/auth/login");
  }

  const [typesResult, insurersResult, ratesResult, splitsResult] =
    await Promise.all([
      supabase
        .from("insurance_types")
        .select("id, code, name, active")
        .order("name", { ascending: true }),
      supabase
        .from("insurers")
        .select("id, insurer_name, short_name, active")
        .order("insurer_name", { ascending: true }),
      supabase
        .from("commission_rate_settings")
        .select("id, insurance_type_id, gross_commission_percent, net_commission_percent, active")
        .order("created_at", { ascending: true }),
      supabase
        .from("commission_split_patterns")
        .select("id, code, name, active")
        .order("code", { ascending: true }),
    ]);

  const insuranceTypes = (typesResult.data ?? []) as InsuranceType[];
  const insurers = (insurersResult.data ?? []) as Insurer[];
  const rates = (ratesResult.data ?? []) as CommissionRate[];
  const splits = (splitsResult.data ?? []) as SplitPattern[];
  const typeNameById = new Map(insuranceTypes.map((type) => [type.id, type.name]));
  const errors = [
    typesResult.error?.message,
    insurersResult.error?.message,
    ratesResult.error?.message,
    splitsResult.error?.message,
  ].filter((message): message is string => Boolean(message));

  return (
    <PageShell title="Settings">
      {errors.length ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {errors.join(" ")}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <TableCard
          columns={["Insurance Type", "Code", "Status"]}
          rows={insuranceTypes.map((type) => [
            clean(type.name),
            clean(type.code),
            type.active ? "Active" : "Inactive",
          ])}
          title="Insurance Types"
        />
        <TableCard
          columns={["Insurer", "Short Name", "Status"]}
          rows={insurers.map((insurer) => [
            clean(insurer.insurer_name),
            clean(insurer.short_name),
            insurer.active ? "Active" : "Inactive",
          ])}
          title="Insurers"
        />
        <TableCard
          columns={["Type", "Commission", "Net", "Status"]}
          rows={rates.map((rate) => [
            clean(typeNameById.get(rate.insurance_type_id ?? "") ?? null),
            percent(rate.gross_commission_percent),
            percent(rate.net_commission_percent),
            rate.active ? "Active" : "Inactive",
          ])}
          title="Commission Rates"
        />
        <TableCard
          columns={["Pattern", "Name", "Status"]}
          rows={splits.map((split) => [
            clean(split.code),
            clean(split.name),
            split.active ? "Active" : "Inactive",
          ])}
          title="Split Patterns"
        />
      </section>
    </PageShell>
  );
}

function PageShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-950">
      <header className="border-b border-sky-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <Link
              className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-sky-700"
              href="/protected"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <Settings className="h-5 w-5" />
              {title}
            </h1>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5">
        {children}
      </div>
    </main>
  );
}

function TableCard({
  columns,
  rows,
  title,
}: {
  columns: string[];
  rows: string[][];
  title: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white/95 shadow-sm">
      <div className="border-b border-sky-100 bg-sky-50/50 px-4 py-3">
        <h2 className="font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-white text-xs uppercase text-slate-500">
            <tr>
              {columns.map((column) => (
                <th className="px-3 py-3 font-medium" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, rowIndex) => (
                <tr className="border-t border-slate-100" key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td className="px-3 py-3" key={`${rowIndex}-${cellIndex}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="px-3 py-8 text-center text-zinc-500"
                  colSpan={columns.length}
                >
                  No records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
