"use client";

import {
  ArrowDown,
  ArrowUp,
  BadgeDollarSign,
  CalendarDays,
  Car,
  CircleDollarSign,
  ClipboardList,
  Copy,
  Eye,
  FileText,
  Flame,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { InsurerBadge } from "@/components/insurer-badge";
import { PremiumStatusSelect } from "@/components/premium-status-select";

export type PolicyRecord = {
  policy_term_id: string;
  policy_series_id: string;
  client_id: string;
  client_name: string | null;
  insurance_type: string | null;
  insurance_type_code?: string | null;
  risk_type?: string | null;
  primary_risk_label: string | null;
  policy_number: string | null;
  insurer_name: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  primary_sum_assured: number | string | null;
  gross_premium: number | string | null;
  net_premium: number | string | null;
  premium_status: string | null;
  term_stage: string | null;
  quotation_status: string | null;
  policy_status: string | null;
  renewal_status: string | null;
  split_pattern_code?: string | null;
  split_pattern_name?: string | null;
  vehicle_no: string | null;
  make_model?: string | null;
  year_of_manufacture?: number | string | null;
  motor_type: string | null;
  type_of_cover?: string | null;
  ncd: number | string | null;
  created_at?: string | null;
};

type CommissionTotalRow = {
  policy_term_id: string;
  amount: number | string | null;
  unpaid_amount?: number | string | null;
  status?: string | null;
};

type CommissionSummary = {
  status: "paid" | "unpaid" | "partial" | "none";
  total: number;
};

type SortDirection = "asc" | "desc";
type DateBasis = "expiry_date" | "effective_date";
type PeriodFilter = "all" | "this_month" | "next_30" | "next_60" | "this_year" | "expired";
type GroupBy =
  | "none"
  | "expiry_month"
  | "effective_month"
  | "risk_type"
  | "insurer"
  | "premium_status";
type SortBy =
  | "created_at"
  | "expiry_date"
  | "effective_date"
  | "client"
  | "risk_type"
  | "gross_premium"
  | "premium_status";

const periodOptions: Array<{ value: PeriodFilter; label: string }> = [
  { value: "all", label: "All Dates" },
  { value: "this_month", label: "This Month" },
  { value: "next_30", label: "Next 30 Days" },
  { value: "next_60", label: "Next 60 Days" },
  { value: "this_year", label: "This Year" },
  { value: "expired", label: "Expired" },
];

const groupOptions: Array<{ value: GroupBy; label: string }> = [
  { value: "none", label: "No Group" },
  { value: "expiry_month", label: "Expiry Month" },
  { value: "effective_month", label: "Effective Month" },
  { value: "risk_type", label: "Risk" },
  { value: "insurer", label: "Insurer" },
  { value: "premium_status", label: "Premium Status" },
];

const sortOptions: Array<{ value: SortBy; label: string }> = [
  { value: "effective_date", label: "Effective Date" },
  { value: "expiry_date", label: "Expiry Date" },
  { value: "created_at", label: "Newest" },
  { value: "client", label: "Client" },
  { value: "risk_type", label: "Risk" },
  { value: "gross_premium", label: "Gross Premium" },
  { value: "premium_status", label: "Premium Status" },
];

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number | string | null | undefined) {
  const amount = toNumber(value);
  if (!amount) return "-";
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function percent(value: number | string | null | undefined) {
  const amount = toNumber(value);
  if (!amount) return "-";
  return `${(amount * 100).toFixed(0)}%`;
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

function dateHighlightClass(value: string | null | undefined) {
  const parsed = parseDate(value);
  if (!parsed) return "bg-slate-50 text-slate-600 ring-slate-100";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  if (sameMonth(parsed, today)) {
    return "bg-emerald-50 text-emerald-800 ring-emerald-100";
  }
  if (sameMonth(parsed, nextMonth)) {
    return "bg-yellow-50 text-yellow-800 ring-yellow-100";
  }
  return "bg-slate-50 text-slate-600 ring-slate-100";
}

function DateBadge({ value }: { value: string | null | undefined }) {
  return (
    <span
      className={`inline-flex min-w-24 justify-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${dateHighlightClass(value)}`}
    >
      {formatDate(value)}
    </span>
  );
}

function formatMonth(value: string | null | undefined) {
  if (!value) return "No Date";
  const parsed = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function dateMatchesPeriod(date: Date | null, period: PeriodFilter) {
  if (period === "all") return true;
  if (!date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (period === "this_month") return sameMonth(date, today);
  if (period === "this_year") return date.getFullYear() === today.getFullYear();
  if (period === "expired") return date < today;
  if (period === "next_30") return date >= today && date <= addDays(today, 30);
  if (period === "next_60") return date >= today && date <= addDays(today, 60);

  return true;
}

function monthKey(value: string | null | undefined) {
  return value ? value.slice(0, 7) : "";
}

function shortRiskType(value: string) {
  return value.replace(/\s+risk$/i, "");
}

function riskType(record: PolicyRecord) {
  if (record.risk_type) return shortRiskType(record.risk_type);
  if (record.vehicle_no || record.insurance_type_code === "motor") return "Motor";
  if (record.insurance_type_code === "fire") return "Fire";
  if (record.insurance_type_code === "marine_insurance") return "Marine";
  if (record.insurance_type_code === "travel") return "Travel";
  if (
    record.insurance_type_code === "equipment_insurance" ||
    record.insurance_type_code === "equipment_all_risk"
  ) {
    return "Equipment";
  }
  return record.insurance_type ? shortRiskType(record.insurance_type) : "Policy";
}

function riskLabel(record: PolicyRecord) {
  return record.primary_risk_label || record.vehicle_no || record.policy_number || "-";
}

function vehicleNo(record: PolicyRecord) {
  const type = riskType(record).toLowerCase();
  if (type === "motor" || type === "equipment") {
    return record.vehicle_no || record.primary_risk_label || "-";
  }
  return record.vehicle_no || "-";
}

function RiskIcon({ record }: { record: PolicyRecord }) {
  const type = riskType(record).toLowerCase();
  const className = "h-4 w-4";
  if (type.includes("motor")) return <Car className={className} />;
  if (type.includes("fire")) return <Flame className={className} />;
  if (type.includes("equipment")) return <ClipboardList className={className} />;
  return <ShieldCheck className={className} />;
}

function stageLabel(record: PolicyRecord) {
  return record.term_stage === "quotation" ? "Q" : "P";
}

function stageFullLabel(record: PolicyRecord) {
  return record.term_stage === "quotation" ? "Quotation" : "Policy";
}

function stageMeta(record: PolicyRecord) {
  return record.term_stage === "quotation"
    ? clean(record.quotation_status)
    : clean(record.policy_status);
}

function StageBadge({ record }: { record: PolicyRecord }) {
  const isQuotation = record.term_stage === "quotation";
  return (
    <span
      className={`inline-flex min-w-8 items-center justify-center rounded-full px-2 py-1 text-xs font-semibold ${
        isQuotation
          ? "bg-orange-50 text-orange-800 ring-1 ring-orange-200"
          : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
      }`}
      title={`${stageFullLabel(record)} / ${stageMeta(record)}`}
    >
      {stageLabel(record)}
    </span>
  );
}

function splitCode(record: PolicyRecord) {
  return clean(record.split_pattern_code);
}

function commissionRowIsPaid(row: CommissionTotalRow) {
  if (String(row.status ?? "").toLowerCase() === "paid") return true;
  return toNumber(row.amount) > 0 && toNumber(row.unpaid_amount) <= 0;
}

function commissionStatusLabel(status: CommissionSummary["status"]) {
  if (status === "paid") return "Paid";
  if (status === "partial") return "Partial";
  if (status === "unpaid") return "Unpaid";
  return "-";
}

function CommissionStatusBadge({ summary }: { summary?: CommissionSummary }) {
  const status = summary?.status ?? "none";
  const className =
    status === "paid"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : status === "partial"
        ? "bg-yellow-50 text-yellow-800 ring-yellow-200"
        : status === "unpaid"
          ? "bg-rose-50 text-rose-800 ring-rose-200"
          : "bg-slate-50 text-slate-500 ring-slate-200";

  return (
    <span
      className={`inline-flex min-w-16 justify-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${className}`}
      title={summary ? `Commission: ${money(summary.total)}` : "No commission rows"}
    >
      {commissionStatusLabel(status)}
    </span>
  );
}

function compareValues(a: string | number, b: string | number) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en", {
    numeric: true,
    sensitivity: "base",
  });
}

function dateSortValue(value: string | null | undefined) {
  if (!value) return null;
  const raw = String(value).trim();

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const parsed = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }

  const slashMatch = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
  if (slashMatch) {
    const year =
      slashMatch[3].length === 2
        ? Number(slashMatch[3]) >= 70
          ? `19${slashMatch[3]}`
          : `20${slashMatch[3]}`
        : slashMatch[3];
    const parsed = new Date(
      `${year}-${slashMatch[2].padStart(2, "0")}-${slashMatch[1].padStart(2, "0")}T00:00:00`,
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }

  const monthMatch = raw.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (monthMatch) {
    const monthIndex = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ].indexOf(monthMatch[2].slice(0, 3).toLowerCase());
    if (monthIndex >= 0) {
      const parsed = new Date(
        Number(monthMatch[3]),
        monthIndex,
        Number(monthMatch[1]),
      );
      return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
    }
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function sortValue(record: PolicyRecord, sortBy: SortBy) {
  if (sortBy === "created_at") return dateSortValue(record.created_at);
  if (sortBy === "expiry_date") return dateSortValue(record.expiry_date);
  if (sortBy === "effective_date") return dateSortValue(record.effective_date);
  if (sortBy === "client") return clean(record.client_name);
  if (sortBy === "risk_type") return clean(record.insurance_type);
  if (sortBy === "gross_premium") return toNumber(record.gross_premium);
  if (sortBy === "premium_status") return clean(record.premium_status);
  return null;
}

function compareSortValues(
  a: string | number | null,
  b: string | number | null,
  direction: SortDirection,
) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const result = compareValues(a, b);
  return direction === "asc" ? result : result * -1;
}

function groupKey(record: PolicyRecord, groupBy: GroupBy) {
  if (groupBy === "expiry_month") return formatMonth(monthKey(record.expiry_date));
  if (groupBy === "effective_month") return formatMonth(monthKey(record.effective_date));
  if (groupBy === "risk_type") return clean(record.insurance_type);
  if (groupBy === "insurer") return clean(record.insurer_name);
  if (groupBy === "premium_status") return clean(record.premium_status);
  return "All Records";
}

function uniqueOptions(records: PolicyRecord[], getValue: (record: PolicyRecord) => string) {
  return Array.from(new Set(records.map(getValue).filter((value) => value && value !== "-")))
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

export function RecordsPanel({
  commissionTotals,
  policies,
}: {
  commissionTotals: CommissionTotalRow[];
  policies: PolicyRecord[];
}) {
  const [query, setQuery] = useState("");
  const [dateBasis, setDateBasis] = useState<DateBasis>("effective_date");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [insurerFilter, setInsurerFilter] = useState("all");
  const [premiumFilter, setPremiumFilter] = useState("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [sortBy, setSortBy] = useState<SortBy>("effective_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [previewRecord, setPreviewRecord] = useState<PolicyRecord | null>(null);

  function updateDateBasis(value: DateBasis) {
    setDateBasis(value);
    setSortBy(value);
  }

  const riskOptions = useMemo(
    () => uniqueOptions(policies, (record) => clean(record.insurance_type)),
    [policies],
  );
  const insurerOptions = useMemo(
    () => uniqueOptions(policies, (record) => clean(record.insurer_name)),
    [policies],
  );
  const premiumOptions = useMemo(
    () => uniqueOptions(policies, (record) => clean(record.premium_status)),
    [policies],
  );
  const commissionSummaryByPolicy = useMemo(() => {
    const grouped = new Map<string, CommissionTotalRow[]>();
    for (const row of commissionTotals) {
      grouped.set(row.policy_term_id, [...(grouped.get(row.policy_term_id) ?? []), row]);
    }

    const summaries = new Map<string, CommissionSummary>();
    for (const [policyTermId, rows] of grouped.entries()) {
      const paidRows = rows.filter((row) => commissionRowIsPaid(row)).length;
      const status =
        paidRows === rows.length ? "paid" : paidRows === 0 ? "unpaid" : "partial";
      summaries.set(policyTermId, {
        status,
        total: rows.reduce((sum, row) => sum + toNumber(row.amount), 0),
      });
    }

    return summaries;
  }, [commissionTotals]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return policies.filter((record) => {
      const date = parseDate(record[dateBasis]);
      if (!dateMatchesPeriod(date, period)) return false;
      if (riskFilter !== "all" && clean(record.insurance_type) !== riskFilter) return false;
      if (insurerFilter !== "all" && clean(record.insurer_name) !== insurerFilter) {
        return false;
      }
      if (premiumFilter !== "all" && clean(record.premium_status) !== premiumFilter) {
        return false;
      }
      if (!q) return true;

      return [
        record.client_name,
        record.policy_number,
        record.insurer_name,
        record.insurance_type,
        record.split_pattern_code,
        record.split_pattern_name,
        record.vehicle_no,
        record.primary_risk_label,
        record.make_model,
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(q),
      );
    });
  }, [
    dateBasis,
    insurerFilter,
    period,
    policies,
    premiumFilter,
    query,
    riskFilter,
  ]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      return compareSortValues(sortValue(a, sortBy), sortValue(b, sortBy), sortDirection);
    });
  }, [filteredRows, sortBy, sortDirection]);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, PolicyRecord[]>();
    for (const row of sortedRows) {
      const key = groupBy === "none" ? "All Records" : groupKey(row, groupBy);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return Array.from(groups.entries());
  }, [groupBy, sortedRows]);

  const totalGross = useMemo(
    () => filteredRows.reduce((sum, record) => sum + toNumber(record.gross_premium), 0),
    [filteredRows],
  );
  const cardStats = useMemo(() => {
    const visiblePolicyIds = new Set(filteredRows.map((record) => record.policy_term_id));
    const clientIds = new Set(
      filteredRows.map((record) => record.client_id).filter((value) => Boolean(value)),
    );
    const commissionTotal = commissionTotals.reduce((sum, row) => {
      return visiblePolicyIds.has(row.policy_term_id) ? sum + toNumber(row.amount) : sum;
    }, 0);

    return {
      activePolicies: filteredRows.filter(
        (record) => record.term_stage === "policy" && record.policy_status === "active",
      ).length,
      clients: clientIds.size,
      commissionTotal,
      grossPremium: totalGross,
    };
  }, [commissionTotals, filteredRows, totalGross]);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          colorClass="bg-emerald-50 text-emerald-700"
          icon={<FileText className="h-5 w-5" />}
          label="Active Policies"
          value={cardStats.activePolicies.toLocaleString("en-MY")}
        />
        <MetricCard
          colorClass="bg-sky-50 text-sky-700"
          icon={<Users className="h-5 w-5" />}
          label="Clients"
          value={cardStats.clients.toLocaleString("en-MY")}
        />
        <MetricCard
          colorClass="bg-violet-50 text-violet-700"
          icon={<CircleDollarSign className="h-5 w-5" />}
          label="Gross Premium"
          value={money(cardStats.grossPremium)}
        />
        <MetricCard
          colorClass="bg-orange-50 text-orange-700"
          icon={<BadgeDollarSign className="h-5 w-5" />}
          label="Commission"
          value={money(cardStats.commissionTotal)}
        />
      </section>

      <section className="crm-panel">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-700">
              <SlidersHorizontal className="h-5 w-5" />
              <h2 className="text-lg font-semibold text-slate-950">Records Analysis</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {filteredRows.length} records / {money(totalGross)} gross premium
            </p>
          </div>
          <label className="relative block min-w-0 lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="crm-control w-full pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search client, policy, vehicle, insurer"
              value={query}
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SelectField
            label="Filter Date"
            onChange={(value) => updateDateBasis(value as DateBasis)}
            options={[
              { value: "effective_date", label: "Effective Date" },
              { value: "expiry_date", label: "Expiry Date" },
            ]}
            value={dateBasis}
          />
          <SelectField
            label="Period"
            onChange={(value) => setPeriod(value as PeriodFilter)}
            options={periodOptions}
            value={period}
          />
          <SelectField
            label="Risk"
            onChange={setRiskFilter}
            options={[
              { value: "all", label: "All Risks" },
              ...riskOptions.map((value) => ({ value, label: value })),
            ]}
            value={riskFilter}
          />
          <SelectField
            label="Insurer"
            onChange={setInsurerFilter}
            options={[
              { value: "all", label: "All Insurers" },
              ...insurerOptions.map((value) => ({ value, label: value })),
            ]}
            value={insurerFilter}
          />
          <SelectField
            label="Premium"
            onChange={setPremiumFilter}
            options={[
              { value: "all", label: "All Premium Status" },
              ...premiumOptions.map((value) => ({ value, label: value })),
            ]}
            value={premiumFilter}
          />
          <SelectField
            label="Group"
            onChange={(value) => setGroupBy(value as GroupBy)}
            options={groupOptions}
            value={groupBy}
          />
          <SelectField
            label="Sort"
            onChange={(value) => setSortBy(value as SortBy)}
            options={sortOptions}
            value={sortBy}
          />
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
              Direction
            </p>
            <button
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm shadow-slate-900/5 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
              onClick={() =>
                setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
              }
              type="button"
            >
              {sortDirection === "asc" ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
              {sortDirection === "asc" ? "Ascending" : "Descending"}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {groupedRows.map(([group, rows]) => (
          <div
            className="crm-card"
            key={group}
          >
            {groupBy !== "none" ? (
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-sky-700" />
                  <h3 className="font-semibold text-slate-950">{group}</h3>
                </div>
                <p className="text-sm text-slate-500">{rows.length} records</p>
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <PolicyTable
                commissionSummaryByPolicy={commissionSummaryByPolicy}
                rows={rows}
                setPreviewRecord={setPreviewRecord}
              />
            </div>
          </div>
        ))}
      </section>
      {previewRecord ? (
        <RecordPreviewModal
          commissionSummary={commissionSummaryByPolicy.get(previewRecord.policy_term_id)}
          record={previewRecord}
          onClose={() => setPreviewRecord(null)}
        />
      ) : null}
    </div>
  );
}

function MetricCard({
  colorClass,
  icon,
  label,
  value,
}: {
  colorClass: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="crm-stat-card flex min-w-0 items-start gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colorClass}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
        <p className="mt-2 truncate text-xl font-semibold text-slate-950">{value}</p>
      </span>
    </div>
  );
}

function SelectField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  value: string;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
        {label}
      </span>
      <select
        className="crm-control w-full"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PreviewGrid({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {rows
        .filter(([, value]) => value !== "-")
        .map(([label, value]) => (
          <div
            className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
            key={label}
          >
            <dt className="text-[10px] font-semibold uppercase text-slate-500">
              {label}
            </dt>
            <dd className="mt-1 break-words text-sm font-semibold text-slate-950">
              {value}
            </dd>
          </div>
        ))}
    </dl>
  );
}

function RecordPreviewModal({
  commissionSummary,
  onClose,
  record,
}: {
  commissionSummary?: CommissionSummary;
  onClose: () => void;
  record: PolicyRecord;
}) {
  const stageDescription =
    record.term_stage === "quotation"
      ? `Quotation: ${stageMeta(record)}`
      : `Policy: ${stageMeta(record)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4"
      onClick={onClose}
      role="presentation"
    >
      <section
        aria-modal="true"
        className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-100">
                <RiskIcon record={record} />
                {clean(record.insurance_type)}
              </span>
              <StageBadge record={record} />
            </div>
            <h3 className="truncate text-xl font-semibold text-slate-950">
              {clean(record.client_name)}
            </h3>
            <p className="mt-1 text-sm text-slate-500">{stageDescription}</p>
          </div>
          <button
            aria-label="Close preview"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-3">
            <p className="text-xs font-semibold uppercase text-sky-700">Risk</p>
            <p className="mt-1 text-base font-semibold text-slate-950">
              {riskLabel(record)}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Vehicle No: {vehicleNo(record)}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
            <p className="text-xs font-semibold uppercase text-emerald-700">
              Term
            </p>
            <p className="mt-1 text-base font-semibold text-slate-950">
              {formatDate(record.effective_date)}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              to {formatDate(record.expiry_date)}
            </p>
          </div>
          <div className="rounded-xl border border-orange-100 bg-orange-50/70 p-3">
            <p className="text-xs font-semibold uppercase text-orange-700">
              Premium
            </p>
            <p className="mt-1 text-base font-semibold text-slate-950">
              {money(record.gross_premium)}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {clean(record.premium_status)}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
          <PreviewGrid
            rows={[
              ["Policy No", clean(record.policy_number)],
              ["Insurer", <InsurerBadge key="insurer" name={record.insurer_name} />],
              ["Risk", clean(record.insurance_type)],
              ["Split", splitCode(record)],
              [
                "Commission",
                <CommissionStatusBadge key="commission" summary={commissionSummary} />,
              ],
              ["Sum Assured", money(record.primary_sum_assured)],
              ["Net Premium", money(record.net_premium)],
              ["Renewal", clean(record.renewal_status)],
              ["Make / Model", clean(record.make_model)],
              ["Year", clean(record.year_of_manufacture)],
              ["Motor Type", clean(record.motor_type)],
              ["Type of Cover", clean(record.type_of_cover)],
              ["NCD", percent(record.ncd)],
            ]}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Link
            className="inline-flex items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800"
            href={`/protected/policies/${record.policy_term_id}`}
          >
            View Details
          </Link>
        </div>
      </section>
    </div>
  );
}

function PolicyTable({
  commissionSummaryByPolicy,
  rows,
  setPreviewRecord,
}: {
  commissionSummaryByPolicy: Map<string, CommissionSummary>;
  rows: PolicyRecord[];
  setPreviewRecord: (record: PolicyRecord) => void;
}) {
  return (
    <table className="crm-table min-w-[1080px]">
      <thead>
        <tr>
          <th className="px-3 py-2 font-medium">Effective</th>
          <th className="px-3 py-2 font-medium">Expiry</th>
          <th className="px-3 py-2 font-medium">Client</th>
          <th className="px-3 py-2 font-medium">Risk</th>
          <th className="px-3 py-2 font-medium">Vehicle No</th>
          <th className="px-3 py-2 font-medium">Insurer</th>
          <th className="px-3 py-2 font-medium">Stage</th>
          <th className="px-3 py-2 font-medium">Split</th>
          <th className="px-3 py-2 font-medium">Comm</th>
          <th className="px-3 py-2 font-medium">Gross</th>
          <th className="px-3 py-2 font-medium">Premium</th>
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((row) => (
            <tr
              className="cursor-pointer"
              key={row.policy_term_id}
              onDoubleClick={() => {
                window.location.href = `/protected/policies/${row.policy_term_id}`;
              }}
            >
              <td className="px-3 py-2 text-slate-700">
                <DateBadge value={row.effective_date} />
              </td>
              <td className="px-3 py-2 text-slate-700">
                <DateBadge value={row.expiry_date} />
              </td>
              <td className="px-3 py-2 font-medium">
                <span className="flex items-center gap-2">
                  <button
                    aria-label={`Preview ${clean(row.client_name)}`}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-sky-700 transition hover:border-sky-200 hover:bg-sky-50"
                    onClick={(event) => {
                      event.stopPropagation();
                      setPreviewRecord(row);
                    }}
                    type="button"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <Link
                    className="text-slate-950 hover:text-sky-700"
                    href={`/protected/policies/${row.policy_term_id}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {clean(row.client_name)}
                  </Link>
                  <Link
                    aria-label={`Duplicate ${clean(row.client_name)} into a new policy draft`}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                    href={`/protected/new-policy?duplicate=${row.policy_term_id}`}
                    onClick={(event) => event.stopPropagation()}
                    title="Duplicate into new policy draft"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Link>
                </span>
              </td>
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                  <RiskIcon record={row} />
                  {clean(row.insurance_type)}
                </span>
              </td>
              <td className="px-3 py-2 text-slate-700">{vehicleNo(row)}</td>
              <td className="px-3 py-2 text-slate-700">
                <InsurerBadge name={row.insurer_name} />
              </td>
              <td className="px-3 py-2">
                <StageBadge record={row} />
              </td>
              <td className="px-3 py-2 text-slate-700">{splitCode(row)}</td>
              <td className="px-3 py-2">
                <CommissionStatusBadge
                  summary={commissionSummaryByPolicy.get(row.policy_term_id)}
                />
              </td>
              <td className="px-3 py-2 text-slate-700">{money(row.gross_premium)}</td>
              <td className="px-3 py-2 text-slate-700">
                <PremiumStatusSelect
                  policyTermId={row.policy_term_id}
                  status={row.premium_status}
                />
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td className="px-3 py-8 text-center text-slate-500" colSpan={11}>
              No matching records.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
