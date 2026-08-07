"use client";

import {
  ArrowUpRight,
  BadgeDollarSign,
  CalendarClock,
  Car,
  CircleDollarSign,
  FileText,
  Layers3,
  ReceiptText,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AppMenu } from "@/components/app-menu";
import { InsurerBadge } from "@/components/insurer-badge";

export type DesignPreviewPolicy = {
  client_id: string;
  client_name: string | null;
  created_at?: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  gross_premium: number | string | null;
  insurance_type: string | null;
  insurance_type_code?: string | null;
  insurer_name: string | null;
  make_model?: string | null;
  motor_type: string | null;
  net_premium: number | string | null;
  policy_number: string | null;
  policy_status: string | null;
  policy_term_id: string;
  premium_status: string | null;
  primary_risk_label: string | null;
  primary_sum_assured: number | string | null;
  renewal_status: string | null;
  risk_type?: string | null;
  split_pattern_code?: string | null;
  split_pattern_name?: string | null;
  term_stage: string | null;
  vehicle_no: string | null;
};

export type DesignPreviewCommission = {
  amount: number | string | null;
  id: string;
  policy_term_id: string;
  status: string | null;
  unpaid_amount: number | string | null;
};

export type DesignPreviewSummary = {
  active_gross_premium_total: number | string | null;
  active_policy_count: number | string | null;
  client_count: number | string | null;
  renewals_due_60_days: number | string | null;
  unpaid_commission_total: number | string | null;
  unpaid_premium_total: number | string | null;
};

type CommissionSummary = {
  status: "paid" | "unpaid" | "partial" | "none";
  total: number;
  unpaid: number;
};

type FilterMode = "all" | "renewal" | "unpaid" | "quotation";

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number | string | null | undefined) {
  const amount = toNumber(value);
  if (!amount) return "-";
  return new Intl.NumberFormat("en-MY", {
    currency: "MYR",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(amount);
}

function compactMoney(value: number | string | null | undefined) {
  const amount = toNumber(value);
  if (!amount) return "-";
  return new Intl.NumberFormat("en-MY", {
    compactDisplay: "short",
    currency: "MYR",
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency",
  }).format(amount);
}

function clean(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replaceAll("_", " ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB").format(parsed);
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysUntil(value: string | null | undefined) {
  const date = parseDate(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
}

function riskType(record: DesignPreviewPolicy) {
  if (record.risk_type) return clean(record.risk_type).replace(/\s+risk$/i, "");
  if (record.vehicle_no || record.insurance_type_code === "motor") return "Motor";
  if (record.insurance_type_code === "fire") return "Fire";
  if (record.insurance_type_code === "travel") return "Travel";
  if (
    record.insurance_type_code === "equipment_insurance" ||
    record.insurance_type_code === "equipment_all_risk"
  ) {
    return "Equipment";
  }
  return clean(record.insurance_type);
}

function riskLabel(record: DesignPreviewPolicy) {
  return record.vehicle_no || record.primary_risk_label || record.policy_number || "-";
}

function stageCode(record: DesignPreviewPolicy) {
  return record.term_stage === "quotation" ? "Q" : "P";
}

function commissionRowIsPaid(row: DesignPreviewCommission) {
  if (String(row.status ?? "").toLowerCase() === "paid") return true;
  return toNumber(row.amount) > 0 && toNumber(row.unpaid_amount) <= 0;
}

function buildCommissionLookup(rows: DesignPreviewCommission[]) {
  const grouped = new Map<string, DesignPreviewCommission[]>();
  for (const row of rows) {
    grouped.set(row.policy_term_id, [...(grouped.get(row.policy_term_id) ?? []), row]);
  }

  const summaries = new Map<string, CommissionSummary>();
  for (const [policyTermId, group] of grouped.entries()) {
    const paidRows = group.filter((row) => commissionRowIsPaid(row)).length;
    summaries.set(policyTermId, {
      status:
        paidRows === group.length ? "paid" : paidRows === 0 ? "unpaid" : "partial",
      total: group.reduce((sum, row) => sum + toNumber(row.amount), 0),
      unpaid: group.reduce((sum, row) => sum + toNumber(row.unpaid_amount), 0),
    });
  }
  return summaries;
}

function commissionLabel(summary?: CommissionSummary) {
  if (!summary) return "-";
  if (summary.status === "paid") return "Paid";
  if (summary.status === "partial") return "Partial";
  if (summary.status === "unpaid") return "Unpaid";
  return "-";
}

function DateStack({
  end,
  start,
}: {
  end: string | null | undefined;
  start: string | null | undefined;
}) {
  const days = daysUntil(end);
  const urgent = days !== null && days >= 0 && days <= 60;

  return (
    <div className="leading-tight">
      <p className="font-semibold text-slate-950">{formatDate(start)}</p>
      <p className={urgent ? "text-xs font-semibold text-rose-700" : "text-xs text-slate-500"}>
        {formatDate(end)}
      </p>
    </div>
  );
}

function StatusPill({
  tone,
  value,
}: {
  tone: "green" | "red" | "amber" | "neutral" | "ink" | "blue";
  value: string;
}) {
  const classes = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-sky-200 bg-sky-50 text-sky-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    ink: "border-slate-700 bg-slate-900 text-white",
    neutral: "border-slate-200 bg-slate-50 text-slate-600",
    red: "border-rose-200 bg-rose-50 text-rose-800",
  }[tone];

  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${classes}`}>
      {value}
    </span>
  );
}

function MetricTile({
  icon,
  label,
  tone,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "blue" | "green" | "amber" | "rose" | "slate";
  value: string;
}) {
  const iconClasses = {
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-sky-50 text-sky-700",
    green: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-700",
  }[tone];

  return (
    <div className="flex min-w-0 items-center gap-3 border-r border-slate-200 px-4 py-3 last:border-r-0">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${iconClasses}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
        <p className="mt-1 truncate text-xl font-semibold text-slate-950">{value}</p>
      </span>
    </div>
  );
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`h-9 rounded-md border px-3 text-sm font-semibold transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export function DesignPreviewPanel({
  commissions,
  errors,
  policies,
  summary,
}: {
  commissions: DesignPreviewCommission[];
  errors: string[];
  policies: DesignPreviewPolicy[];
  summary: DesignPreviewSummary | null;
}) {
  const [filter, setFilter] = useState<FilterMode>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const commissionLookup = useMemo(() => buildCommissionLookup(commissions), [commissions]);

  const filteredPolicies = useMemo(() => {
    const q = query.trim().toLowerCase();
    return policies.filter((policy) => {
      const commission = commissionLookup.get(policy.policy_term_id);
      const renewalDays = daysUntil(policy.expiry_date);
      const matchesFilter =
        filter === "all" ||
        (filter === "renewal" && renewalDays !== null && renewalDays >= 0 && renewalDays <= 60) ||
        (filter === "unpaid" &&
          (String(policy.premium_status ?? "").toLowerCase() !== "paid" ||
            (commission?.unpaid ?? 0) > 0)) ||
        (filter === "quotation" && policy.term_stage === "quotation");

      if (!matchesFilter) return false;
      if (!q) return true;
      return [
        policy.client_name,
        policy.policy_number,
        policy.vehicle_no,
        policy.insurer_name,
        policy.insurance_type,
        policy.split_pattern_code,
      ].some((value) => String(value ?? "").toLowerCase().includes(q));
    });
  }, [commissionLookup, filter, policies, query]);
  const selected =
    filteredPolicies.find((policy) => policy.policy_term_id === selectedId) ??
    filteredPolicies[0] ??
    policies[0] ??
    null;
  const selectedCommission = selected
    ? commissionLookup.get(selected.policy_term_id)
    : undefined;
  const renewalCount = policies.filter((policy) => {
    const days = daysUntil(policy.expiry_date);
    return days !== null && days >= 0 && days <= 60;
  }).length;
  const unpaidCount = policies.filter((policy) => {
    const commission = commissionLookup.get(policy.policy_term_id);
    return (
      String(policy.premium_status ?? "").toLowerCase() !== "paid" ||
      (commission?.unpaid ?? 0) > 0
    );
  }).length;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="grid min-h-screen xl:grid-cols-[236px_1fr]">
        <aside className="border-r border-slate-200 bg-white px-3 py-4">
          <div className="flex items-center gap-3 px-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-sm font-black text-white">
              K
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-950">Kover CRM</p>
              <p className="text-xs text-slate-500">Design preview</p>
            </div>
          </div>

          <nav className="mt-6 grid gap-1 text-sm">
            <Link
              className="flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 font-semibold text-white"
              href="/protected/design-preview"
            >
              <Layers3 className="h-4 w-4" />
              Preview
            </Link>
            <Link
              className="flex items-center gap-2 rounded-md px-3 py-2 font-medium text-slate-600 hover:bg-slate-100"
              href="/protected"
            >
              <FileText className="h-4 w-4" />
              Current
            </Link>
            <Link
              className="flex items-center gap-2 rounded-md px-3 py-2 font-medium text-slate-600 hover:bg-slate-100"
              href="/protected/records"
            >
              <ShieldCheck className="h-4 w-4" />
              Records
            </Link>
            <Link
              className="flex items-center gap-2 rounded-md px-3 py-2 font-medium text-slate-600 hover:bg-slate-100"
              href="/protected/new-policy"
            >
              <ReceiptText className="h-4 w-4" />
              New Policy
            </Link>
          </nav>
        </aside>

        <section className="min-w-0">
          <header className="border-b border-slate-200 bg-white px-4 py-3">
            <div className="mx-auto flex max-w-[1800px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
                  Operations Dashboard
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Renewals, payments, records, and commissions in one working view.
                </p>
              </div>
              <AppMenu
                activeHref="/protected/design-preview"
                path={["Dashboard", "Design Preview"]}
              />
            </div>
          </header>

          <div className="mx-auto grid max-w-[1800px] gap-4 px-4 py-4 2xl:grid-cols-[1fr_380px]">
            <section className="min-w-0 space-y-4">
              {errors.length ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {errors.join(" ")}
                </div>
              ) : null}

              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="grid divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
                  <MetricTile
                    icon={<FileText className="h-4 w-4" />}
                    label="Policies"
                    tone="blue"
                    value={clean(summary?.active_policy_count)}
                  />
                  <MetricTile
                    icon={<Users className="h-4 w-4" />}
                    label="Clients"
                    tone="green"
                    value={clean(summary?.client_count)}
                  />
                  <MetricTile
                    icon={<CalendarClock className="h-4 w-4" />}
                    label="Renewals"
                    tone="amber"
                    value={clean(summary?.renewals_due_60_days)}
                  />
                  <MetricTile
                    icon={<CircleDollarSign className="h-4 w-4" />}
                    label="Premium"
                    tone="slate"
                    value={compactMoney(summary?.active_gross_premium_total)}
                  />
                  <MetricTile
                    icon={<BadgeDollarSign className="h-4 w-4" />}
                    label="Commission"
                    tone="rose"
                    value={compactMoney(summary?.unpaid_commission_total)}
                  />
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <AttentionCard
                  icon={<CalendarClock className="h-4 w-4" />}
                  label="Renewal queue"
                  tone="amber"
                  value={renewalCount.toLocaleString("en-MY")}
                />
                <AttentionCard
                  icon={<ReceiptText className="h-4 w-4" />}
                  label="Payment follow-up"
                  tone="rose"
                  value={unpaidCount.toLocaleString("en-MY")}
                />
                <AttentionCard
                  icon={<Layers3 className="h-4 w-4" />}
                  label="Loaded records"
                  tone="blue"
                  value={policies.length.toLocaleString("en-MY")}
                />
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-3 py-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
                      All
                    </FilterButton>
                    <FilterButton active={filter === "renewal"} onClick={() => setFilter("renewal")}>
                      Renewals
                    </FilterButton>
                    <FilterButton active={filter === "unpaid"} onClick={() => setFilter("unpaid")}>
                      Unpaid
                    </FilterButton>
                    <FilterButton active={filter === "quotation"} onClick={() => setFilter("quotation")}>
                      Quotation
                    </FilterButton>
                  </div>
                  <label className="relative block min-w-0 xl:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search client, vehicle, insurer"
                      value={query}
                    />
                  </label>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1120px] text-left text-sm">
                    <thead className="sticky top-0 bg-white text-xs uppercase text-slate-500">
                      <tr className="border-b border-slate-200">
                        <th className="px-3 py-2 font-medium">Term</th>
                        <th className="px-3 py-2 font-medium">Client</th>
                        <th className="px-3 py-2 font-medium">Risk</th>
                        <th className="px-3 py-2 font-medium">Insurer</th>
                        <th className="px-3 py-2 font-medium">Stage</th>
                        <th className="px-3 py-2 font-medium">Split</th>
                        <th className="px-3 py-2 font-medium">Premium</th>
                        <th className="px-3 py-2 font-medium">Commission</th>
                        <th className="px-3 py-2 font-medium">Open</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPolicies.length ? (
                        filteredPolicies.map((policy) => {
                          const commission = commissionLookup.get(policy.policy_term_id);
                          const premiumPaid =
                            String(policy.premium_status ?? "").toLowerCase() === "paid";
                          const active = selected?.policy_term_id === policy.policy_term_id;
                          return (
                            <tr
                              className={`cursor-pointer border-b border-slate-100 transition hover:bg-sky-50/60 ${
                                active ? "bg-sky-50/80" : ""
                              }`}
                              key={policy.policy_term_id}
                              onClick={() => setSelectedId(policy.policy_term_id)}
                            >
                              <td className="px-3 py-2">
                                <DateStack end={policy.expiry_date} start={policy.effective_date} />
                              </td>
                              <td className="px-3 py-2">
                                <p className="font-semibold text-slate-950">{clean(policy.client_name)}</p>
                                <p className="text-xs text-slate-500">{clean(policy.policy_number)}</p>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  {riskType(policy).toLowerCase().includes("motor") ? (
                                    <Car className="h-4 w-4 text-sky-700" />
                                  ) : (
                                    <ShieldCheck className="h-4 w-4 text-sky-700" />
                                  )}
                                  <div>
                                    <p className="font-medium text-slate-800">{clean(policy.insurance_type)}</p>
                                    <p className="text-xs text-slate-500">{riskLabel(policy)}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <InsurerBadge name={policy.insurer_name} />
                              </td>
                              <td className="px-3 py-2">
                                <StatusPill
                                  tone={policy.term_stage === "quotation" ? "amber" : "green"}
                                  value={stageCode(policy)}
                                />
                              </td>
                              <td className="px-3 py-2 font-semibold text-slate-700">
                                {clean(policy.split_pattern_code)}
                              </td>
                              <td className="px-3 py-2">
                                <div className="grid gap-1">
                                  <span className="font-semibold text-slate-900">{money(policy.gross_premium)}</span>
                                  <StatusPill
                                    tone={premiumPaid ? "green" : "red"}
                                    value={premiumPaid ? "Paid" : "Unpaid"}
                                  />
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="grid gap-1">
                                  <span className="font-semibold text-slate-900">{money(commission?.total)}</span>
                                  <StatusPill
                                    tone={
                                      commission?.status === "paid"
                                        ? "green"
                                        : commission?.status === "partial"
                                          ? "amber"
                                          : commission?.status === "unpaid"
                                            ? "red"
                                            : "neutral"
                                    }
                                    value={commissionLabel(commission)}
                                  />
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <Link
                                  className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-sky-700 hover:border-sky-200 hover:bg-sky-50"
                                  href={`/protected/policies/${policy.policy_term_id}`}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  Open
                                  <ArrowUpRight className="h-3.5 w-3.5" />
                                </Link>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td className="px-3 py-10 text-center text-slate-500" colSpan={9}>
                            No records match this filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="sticky top-4 rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase text-slate-500">Selected record</p>
                      <h2 className="mt-1 truncate text-lg font-semibold text-slate-950">
                        {selected ? clean(selected.client_name) : "No record"}
                      </h2>
                    </div>
                    {selected ? (
                      <StatusPill
                        tone={selected.term_stage === "quotation" ? "amber" : "ink"}
                        value={selected.term_stage === "quotation" ? "Quotation" : "Policy"}
                      />
                    ) : null}
                  </div>
                </div>

                {selected ? (
                  <div className="space-y-4 p-4">
                    <div className="rounded-lg bg-slate-950 p-4 text-white">
                      <p className="text-xs font-medium uppercase text-white/55">
                        Primary risk
                      </p>
                      <p className="mt-2 text-2xl font-semibold">{riskLabel(selected)}</p>
                      <p className="mt-1 text-sm text-white/65">{clean(selected.insurance_type)}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <DetailItem label="Effective" value={formatDate(selected.effective_date)} />
                      <DetailItem label="Expiry" value={formatDate(selected.expiry_date)} />
                      <DetailItem label="Gross" value={money(selected.gross_premium)} />
                      <DetailItem label="Sum Assured" value={money(selected.primary_sum_assured)} />
                      <DetailItem label="Split" value={clean(selected.split_pattern_code)} />
                      <DetailItem label="Commission" value={commissionLabel(selectedCommission)} />
                    </div>

                    <div className="border-t border-slate-200 pt-4">
                      <p className="text-xs font-medium uppercase text-slate-500">
                        Risk detail
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">{clean(selected.vehicle_no)}</p>
                      <p className="mt-1 text-sm text-slate-600">{clean(selected.make_model)}</p>
                      <p className="mt-1 text-xs text-slate-500">{clean(selected.motor_type)}</p>
                    </div>

                    <Link
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-sky-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800"
                      href={`/protected/policies/${selected.policy_term_id}`}
                    >
                      Open full record
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  <p className="p-4 text-sm text-slate-500">No record available.</p>
                )}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function AttentionCard({
  icon,
  label,
  tone,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "amber" | "blue" | "rose";
  value: string;
}) {
  const classes = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-sky-200 bg-sky-50 text-sky-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
  }[tone];

  return (
    <div className={`flex items-center justify-between rounded-lg border px-4 py-3 ${classes}`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
