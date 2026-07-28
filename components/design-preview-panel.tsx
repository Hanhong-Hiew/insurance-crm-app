"use client";

import {
  ArrowUpRight,
  BadgeDollarSign,
  CalendarClock,
  Car,
  CircleDollarSign,
  FileText,
  Gauge,
  Layers3,
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
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
      <p className="font-semibold text-[#14211f]">{formatDate(start)}</p>
      <p className={urgent ? "text-xs font-semibold text-[#a94a36]" : "text-xs text-[#66736f]"}>
        {formatDate(end)}
      </p>
    </div>
  );
}

function StatusPill({
  tone,
  value,
}: {
  tone: "green" | "red" | "amber" | "neutral" | "ink";
  value: string;
}) {
  const classes = {
    amber: "border-[#e8d69c] bg-[#fff6d7] text-[#7a5c11]",
    green: "border-[#b9ddd1] bg-[#e8f7f0] text-[#14664f]",
    ink: "border-[#2b3b37] bg-[#22312e] text-white",
    neutral: "border-[#d9dfda] bg-white text-[#53615d]",
    red: "border-[#f0c4b9] bg-[#fff0ed] text-[#9a3d2d]",
  }[tone];

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${classes}`}>
      {value}
    </span>
  );
}

function MetricTile({
  detail,
  icon,
  label,
  value,
}: {
  detail: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border-l border-[#d9dfda] bg-white/70 px-4 py-3 first:border-l-0">
      <div className="flex items-center gap-2 text-[#49615a]">
        {icon}
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-normal text-[#16231f]">
        {value}
      </p>
      <p className="mt-1 text-xs text-[#6d7975]">{detail}</p>
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
      className={`h-9 rounded-full border px-3 text-sm font-semibold transition ${
        active
          ? "border-[#263b35] bg-[#263b35] text-white"
          : "border-[#d6ded8] bg-white text-[#4b5d57] hover:border-[#8fa69c]"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
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
  const selected = filteredPolicies[0] ?? policies[0] ?? null;
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
    <main className="min-h-screen bg-[#f4f7f2] text-[#172320]">
      <div className="grid min-h-screen lg:grid-cols-[240px_1fr]">
        <aside className="border-r border-[#d7dfd7] bg-[#1f302c] px-4 py-5 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#d86c4b] text-lg font-black">
              K
            </span>
            <div>
              <p className="text-sm font-semibold">Kover Desk</p>
              <p className="text-xs text-white/60">Design preview</p>
            </div>
          </div>

          <nav className="mt-8 grid gap-2 text-sm">
            <Link className="rounded-xl bg-white/10 px-3 py-2 font-semibold" href="/protected/design-preview">
              Preview Dashboard
            </Link>
            <Link className="rounded-xl px-3 py-2 text-white/75 hover:bg-white/10" href="/protected">
              Current Dashboard
            </Link>
            <Link className="rounded-xl px-3 py-2 text-white/75 hover:bg-white/10" href="/protected/records">
              Records
            </Link>
            <Link className="rounded-xl px-3 py-2 text-white/75 hover:bg-white/10" href="/protected/new-policy">
              New Policy
            </Link>
          </nav>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
              Design idea
            </p>
            <p className="mt-2 text-sm leading-5 text-white/80">
              Less “dashboard cards”, more agency work desk: watch renewals, scan records, open the actual pages.
            </p>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="border-b border-[#d7dfd7] bg-[#fbfcf8]/90 px-4 py-4 backdrop-blur">
            <div className="mx-auto flex max-w-[1800px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#d7dfd7] bg-white px-2.5 py-1 text-xs font-semibold text-[#53645e]">
                  <Sparkles className="h-3.5 w-3.5 text-[#d86c4b]" />
                  Alternative layout
                </div>
                <h1 className="text-3xl font-semibold tracking-normal text-[#172320]">
                  Policy Workbench
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-[#63736d]">
                  Same CRM data, rebuilt as a denser operating screen for renewals, payment follow-up, and record scanning.
                </p>
              </div>
              <AppMenu
                activeHref="/protected/design-preview"
                path={["Dashboard", "Design Preview"]}
              />
            </div>
          </header>

          <div className="mx-auto grid max-w-[1800px] gap-4 px-4 py-4 xl:grid-cols-[1fr_360px]">
            <section className="min-w-0 space-y-4">
              {errors.length ? (
                <div className="rounded-xl border border-[#e9c8b8] bg-[#fff4ee] px-4 py-3 text-sm text-[#963f2e]">
                  {errors.join(" ")}
                </div>
              ) : null}

              <div className="overflow-hidden rounded-2xl border border-[#d7dfd7] bg-white shadow-sm">
                <div className="grid divide-y divide-[#d7dfd7] md:grid-cols-5 md:divide-x md:divide-y-0">
                  <MetricTile
                    detail={`${renewalCount} due soon`}
                    icon={<FileText className="h-4 w-4" />}
                    label="Policies"
                    value={clean(summary?.active_policy_count)}
                  />
                  <MetricTile
                    detail="Unique records"
                    icon={<Users className="h-4 w-4" />}
                    label="Clients"
                    value={clean(summary?.client_count)}
                  />
                  <MetricTile
                    detail="Next 60 days"
                    icon={<CalendarClock className="h-4 w-4" />}
                    label="Renewals"
                    value={clean(summary?.renewals_due_60_days)}
                  />
                  <MetricTile
                    detail="Gross active book"
                    icon={<CircleDollarSign className="h-4 w-4" />}
                    label="Premium"
                    value={compactMoney(summary?.active_gross_premium_total)}
                  />
                  <MetricTile
                    detail="Unpaid commission"
                    icon={<BadgeDollarSign className="h-4 w-4" />}
                    label="Commission"
                    value={compactMoney(summary?.unpaid_commission_total)}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-[#d7dfd7] bg-[#233530] p-4 text-white">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Renewal pressure</p>
                    <Gauge className="h-5 w-5 text-[#e5c466]" />
                  </div>
                  <p className="mt-4 text-3xl font-semibold">{renewalCount}</p>
                  <p className="mt-1 text-sm text-white/65">records expiring within 60 days</p>
                </div>
                <div className="rounded-2xl border border-[#f0c7b8] bg-[#fff2ec] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#8f3f2f]">Payment follow-up</p>
                    <ReceiptText className="h-5 w-5 text-[#d86c4b]" />
                  </div>
                  <p className="mt-4 text-3xl font-semibold text-[#172320]">{unpaidCount}</p>
                  <p className="mt-1 text-sm text-[#8b6256]">premium or commission not fully cleared</p>
                </div>
                <div className="rounded-2xl border border-[#d7dfd7] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#42554e]">Loaded records</p>
                    <Layers3 className="h-5 w-5 text-[#2c7d6f]" />
                  </div>
                  <p className="mt-4 text-3xl font-semibold">{policies.length}</p>
                  <p className="mt-1 text-sm text-[#66736f]">latest policies available in this preview</p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#d7dfd7] bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-[#d7dfd7] p-3 xl:flex-row xl:items-center xl:justify-between">
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
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#87928e]" />
                    <input
                      className="h-10 w-full rounded-full border border-[#d6ded8] bg-[#fbfcf8] pl-9 pr-3 text-sm outline-none transition focus:border-[#2c7d6f] focus:ring-2 focus:ring-[#cce4dd]"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search client, vehicle, insurer"
                      value={query}
                    />
                  </label>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1080px] text-left text-sm">
                    <thead className="bg-[#f8faf6] text-[11px] uppercase tracking-[0.12em] text-[#71807b]">
                      <tr>
                        <th className="px-3 py-3 font-semibold">Term</th>
                        <th className="px-3 py-3 font-semibold">Client</th>
                        <th className="px-3 py-3 font-semibold">Risk</th>
                        <th className="px-3 py-3 font-semibold">Insurer</th>
                        <th className="px-3 py-3 font-semibold">Stage</th>
                        <th className="px-3 py-3 font-semibold">Split</th>
                        <th className="px-3 py-3 font-semibold">Premium</th>
                        <th className="px-3 py-3 font-semibold">Commission</th>
                        <th className="px-3 py-3 font-semibold">Open</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPolicies.length ? (
                        filteredPolicies.map((policy) => {
                          const commission = commissionLookup.get(policy.policy_term_id);
                          const premiumPaid =
                            String(policy.premium_status ?? "").toLowerCase() === "paid";
                          return (
                            <tr
                              className="border-t border-[#edf1ed] transition hover:bg-[#f8faf6]"
                              key={policy.policy_term_id}
                            >
                              <td className="px-3 py-3">
                                <DateStack end={policy.expiry_date} start={policy.effective_date} />
                              </td>
                              <td className="px-3 py-3">
                                <p className="font-semibold text-[#172320]">{clean(policy.client_name)}</p>
                                <p className="text-xs text-[#66736f]">{clean(policy.policy_number)}</p>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  {riskType(policy).toLowerCase().includes("motor") ? (
                                    <Car className="h-4 w-4 text-[#2c7d6f]" />
                                  ) : (
                                    <ShieldCheck className="h-4 w-4 text-[#2c7d6f]" />
                                  )}
                                  <div>
                                    <p className="font-medium">{riskType(policy)}</p>
                                    <p className="text-xs text-[#66736f]">{riskLabel(policy)}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <InsurerBadge name={policy.insurer_name} />
                              </td>
                              <td className="px-3 py-3">
                                <StatusPill
                                  tone={policy.term_stage === "quotation" ? "amber" : "green"}
                                  value={stageCode(policy)}
                                />
                              </td>
                              <td className="px-3 py-3 font-semibold text-[#4c5c57]">
                                {clean(policy.split_pattern_code)}
                              </td>
                              <td className="px-3 py-3">
                                <div className="grid gap-1">
                                  <span className="font-semibold">{money(policy.gross_premium)}</span>
                                  <StatusPill
                                    tone={premiumPaid ? "green" : "red"}
                                    value={premiumPaid ? "Paid" : "Unpaid"}
                                  />
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="grid gap-1">
                                  <span className="font-semibold">{money(commission?.total)}</span>
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
                              <td className="px-3 py-3">
                                <Link
                                  className="inline-flex h-8 items-center gap-1 rounded-full border border-[#d6ded8] px-3 text-xs font-semibold text-[#2c655b] hover:border-[#2c7d6f]"
                                  href={`/protected/policies/${policy.policy_term_id}`}
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
                          <td className="px-3 py-10 text-center text-[#66736f]" colSpan={9}>
                            No records match this preview filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="sticky top-4 rounded-2xl border border-[#d7dfd7] bg-[#fbfcf8] p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-[#d7dfd7] pb-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#70817b]">
                      Preview panel
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-[#172320]">
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

                {selected ? (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl bg-[#22312e] p-4 text-white">
                      <p className="text-xs uppercase tracking-[0.12em] text-white/55">
                        Primary risk
                      </p>
                      <p className="mt-2 text-2xl font-semibold">{riskLabel(selected)}</p>
                      <p className="mt-1 text-sm text-white/65">{riskType(selected)}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <SmallFact label="Effective" value={formatDate(selected.effective_date)} />
                      <SmallFact label="Expiry" value={formatDate(selected.expiry_date)} />
                      <SmallFact label="Gross" value={money(selected.gross_premium)} />
                      <SmallFact label="Sum Assured" value={money(selected.primary_sum_assured)} />
                      <SmallFact label="Split" value={clean(selected.split_pattern_code)} />
                      <SmallFact label="Commission" value={commissionLabel(selectedCommission)} />
                    </div>

                    <div className="rounded-2xl border border-[#d7dfd7] bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#70817b]">
                        Vehicle / detail
                      </p>
                      <p className="mt-2 text-sm font-semibold">{clean(selected.vehicle_no)}</p>
                      <p className="mt-1 text-sm text-[#66736f]">{clean(selected.make_model)}</p>
                      <p className="mt-1 text-xs text-[#8a9691]">{clean(selected.motor_type)}</p>
                    </div>

                    <Link
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#d86c4b] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c95c3e]"
                      href={`/protected/policies/${selected.policy_term_id}`}
                    >
                      Open full record
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[#66736f]">No record available.</p>
                )}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function SmallFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#d7dfd7] bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#74817d]">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-[#172320]">{value}</p>
    </div>
  );
}
