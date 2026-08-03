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
  EyeOff,
  FileText,
  Flame,
  ReceiptText,
  Search,
  ShieldCheck,
  TableProperties,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AppMenu } from "@/components/app-menu";
import { InsurerBadge } from "@/components/insurer-badge";
import { KoverLogo } from "@/components/kover-logo";
import { PremiumStatusSelect } from "@/components/premium-status-select";

type PolicyRecord = {
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

type CommissionRecord = {
  commission_id: string;
  policy_term_id: string;
  client_name: string | null;
  policy_number: string | null;
  insurance_type: string | null;
  payee_name: string | null;
  calculation_percent: number | string | null;
  amount: number | string | null;
  unpaid_amount: number | string | null;
  status: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  paid_date?: string | null;
  statement_no?: string | null;
};

type DashboardSummary = {
  active_policy_count: number | string | null;
  client_count: number | string | null;
  renewals_due_60_days: number | string | null;
  active_gross_premium_total: number | string | null;
  unpaid_premium_total: number | string | null;
  unpaid_commission_total: number | string | null;
  document_attention_count: number | string | null;
  tasks_due_today_count: number | string | null;
};

type PolicyCommissionSummary = {
  status: "paid" | "unpaid" | "partial" | "none";
  total: number;
};

type ViewMode =
  | "renewals"
  | "premium"
  | "commission"
  | "missing_split"
  | "commissions";
type SortDirection = "asc" | "desc";
type RecordSort =
  | "expiry_date"
  | "effective_date"
  | "risk_type"
  | "client"
  | "value"
  | "status";

type CrmMainPanelProps = {
  summary: DashboardSummary | null;
  commissions: CommissionRecord[];
  policies: PolicyRecord[];
  renewals: PolicyRecord[];
  unpaidPremium: PolicyRecord[];
  unpaidCommission: CommissionRecord[];
  errors: string[];
};

const viewOptions: Array<{
  id: ViewMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "renewals", label: "Renewals", icon: CalendarDays },
  { id: "premium", label: "Unpaid Premium", icon: ReceiptText },
  { id: "commission", label: "Unpaid Commission", icon: WalletCards },
  { id: "missing_split", label: "No Split", icon: BadgeDollarSign },
  { id: "commissions", label: "Commission Ledger", icon: BadgeDollarSign },
];

const recordSortOptions: Array<{ value: RecordSort; label: string }> = [
  { value: "effective_date", label: "Effective Date" },
  { value: "expiry_date", label: "Expiry Date" },
  { value: "risk_type", label: "Risk Type" },
  { value: "client", label: "Client" },
  { value: "value", label: "Value" },
  { value: "status", label: "Status" },
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

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB").format(parsed);
}

function clean(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replaceAll("_", " ");
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
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

function count(value: number | string | null | undefined) {
  return toNumber(value).toLocaleString("en-MY");
}

function compareValues(a: string | number, b: string | number) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en", {
    numeric: true,
    sensitivity: "base",
  });
}

function sortMultiplier(direction: SortDirection) {
  return direction === "asc" ? 1 : -1;
}

function dateSortValue(value: string | null | undefined) {
  const parsed = parseDate(value);
  return parsed ? parsed.getTime() : null;
}

function compareRecordSortValues(
  a: string | number | null,
  b: string | number | null,
  direction: SortDirection,
) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const result = compareValues(a, b);
  return result * sortMultiplier(direction);
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

function hasSplitPattern(record: PolicyRecord) {
  return String(record.split_pattern_code ?? "").trim().length > 0;
}

function commissionRowIsPaid(row: CommissionRecord) {
  if (String(row.status ?? "").toLowerCase() === "paid") return true;
  return toNumber(row.amount) > 0 && toNumber(row.unpaid_amount) <= 0;
}

function commissionStatusLabel(status: PolicyCommissionSummary["status"]) {
  if (status === "paid") return "Paid";
  if (status === "partial") return "Partial";
  if (status === "unpaid") return "Unpaid";
  return "-";
}

function CommissionStatusBadge({ summary }: { summary?: PolicyCommissionSummary }) {
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

function isCommissionRecord(
  record: PolicyRecord | CommissionRecord,
): record is CommissionRecord {
  return "commission_id" in record;
}

function recordSortValue(record: PolicyRecord | CommissionRecord, sort: RecordSort) {
  if (sort === "expiry_date") return dateSortValue(record.expiry_date);
  if (sort === "effective_date") return dateSortValue(record.effective_date);
  if (sort === "client") return clean(record.client_name);

  if (isCommissionRecord(record)) {
    if (sort === "risk_type") return clean(record.insurance_type);
    if (sort === "value") return toNumber(record.amount);
    if (sort === "status") return clean(record.status);
    return "";
  }

  if (sort === "risk_type") return riskType(record);
  if (sort === "value") return toNumber(record.gross_premium);
  if (sort === "status") {
    return clean(record.premium_status || record.policy_status || record.renewal_status);
  }
  return "";
}

export function CrmMainPanel({
  commissions,
  summary,
  policies,
  renewals,
  unpaidPremium,
  unpaidCommission,
  errors,
}: CrmMainPanelProps) {
  const [view, setView] = useState<ViewMode>("renewals");
  const [query, setQuery] = useState("");
  const [hideDashboardValues, setHideDashboardValues] = useState(false);
  const [newestLimit, setNewestLimit] = useState(5);
  const [recordSort, setRecordSort] = useState<RecordSort>("effective_date");
  const [recordSortDirection, setRecordSortDirection] = useState<SortDirection>("asc");
  const [selected, setSelected] = useState<PolicyRecord | CommissionRecord | null>(
    policies[0] || renewals[0] || unpaidPremium[0] || unpaidCommission[0] || null,
  );
  const [previewRecord, setPreviewRecord] = useState<PolicyRecord | CommissionRecord | null>(
    null,
  );

  const missingSplitPolicies = useMemo(
    () => policies.filter((policy) => !hasSplitPattern(policy)),
    [policies],
  );

  const activeRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows =
      view === "renewals"
        ? renewals
        : view === "premium"
          ? unpaidPremium
          : view === "commission"
            ? unpaidCommission
            : view === "missing_split"
              ? missingSplitPolicies
              : commissions;

    if (!q) return rows;

    return rows.filter((row) =>
      Object.values(row).some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [
    commissions,
    missingSplitPolicies,
    query,
    renewals,
    unpaidCommission,
    unpaidPremium,
    view,
  ]);

  const sortedRows = useMemo(() => {
    return [...activeRows].sort((a, b) => {
      return compareRecordSortValues(
        recordSortValue(a, recordSort),
        recordSortValue(b, recordSort),
        recordSortDirection,
      );
    });
  }, [activeRows, recordSort, recordSortDirection]);

  const commissionSummary = useMemo(() => {
    const totals = new Map<string, { amount: number; unpaid: number; count: number }>();
    for (const row of commissions) {
      const key = clean(row.payee_name);
      const current = totals.get(key) ?? { amount: 0, unpaid: 0, count: 0 };
      current.amount += toNumber(row.amount);
      current.unpaid += toNumber(row.unpaid_amount);
      current.count += 1;
      totals.set(key, current);
    }
    return [...totals.entries()].sort((a, b) => b[1].amount - a[1].amount);
  }, [commissions]);
  const commissionSummaryByPolicy = useMemo(() => {
    const grouped = new Map<string, CommissionRecord[]>();
    for (const row of commissions) {
      grouped.set(row.policy_term_id, [...(grouped.get(row.policy_term_id) ?? []), row]);
    }

    const summaries = new Map<string, PolicyCommissionSummary>();
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
  }, [commissions]);

  const metrics = useMemo<Array<{
    label: string;
    value: string;
    numericValue: number;
    icon: React.ReactNode;
    colorClass: string;
    order: number;
  }>>(
    () => [
      {
        label: "Active Policies",
        value: count(summary?.active_policy_count),
        numericValue: toNumber(summary?.active_policy_count),
        icon: <FileText className="h-5 w-5" />,
        colorClass: "text-sky-700 bg-sky-50",
        order: 1,
      },
      {
        label: "Clients",
        value: count(summary?.client_count),
        numericValue: toNumber(summary?.client_count),
        icon: <Users className="h-5 w-5" />,
        colorClass: "text-emerald-700 bg-emerald-50",
        order: 2,
      },
      {
        label: "Renewals 60 Days",
        value: count(summary?.renewals_due_60_days),
        numericValue: toNumber(summary?.renewals_due_60_days),
        icon: <CalendarDays className="h-5 w-5" />,
        colorClass: "text-amber-700 bg-amber-50",
        order: 3,
      },
      {
        label: "Gross Premium",
        value: money(summary?.active_gross_premium_total),
        numericValue: toNumber(summary?.active_gross_premium_total),
        icon: <CircleDollarSign className="h-5 w-5" />,
        colorClass: "text-violet-700 bg-violet-50",
        order: 4,
      },
      {
        label: "Unpaid Premium",
        value: money(summary?.unpaid_premium_total),
        numericValue: toNumber(summary?.unpaid_premium_total),
        icon: <ReceiptText className="h-5 w-5" />,
        colorClass: "text-red-700 bg-red-50",
        order: 5,
      },
      {
        label: "Unpaid Commission",
        value: money(summary?.unpaid_commission_total),
        numericValue: toNumber(summary?.unpaid_commission_total),
        icon: <WalletCards className="h-5 w-5" />,
        colorClass: "text-orange-700 bg-orange-50",
        order: 6,
      },
      {
        label: "Missing Split",
        value: count(missingSplitPolicies.length),
        numericValue: missingSplitPolicies.length,
        icon: <BadgeDollarSign className="h-5 w-5" />,
        colorClass: "text-rose-700 bg-rose-50",
        order: 7,
      },
      {
        label: "Quotations",
        value: count(
          policies.filter((policy) => policy.term_stage === "quotation").length,
        ),
        numericValue: policies.filter((policy) => policy.term_stage === "quotation").length,
        icon: <ClipboardList className="h-5 w-5" />,
        colorClass: "text-cyan-700 bg-cyan-50",
        order: 8,
      },
    ],
    [missingSplitPolicies, policies, summary],
  );

  const newestPolicies = useMemo(
    () =>
      [...policies]
        .sort((a, b) =>
          String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
        )
        .slice(0, newestLimit),
    [newestLimit, policies],
  );
  const activeViewDescription =
    view === "renewals"
      ? "Policies coming up for renewal, sorted by the selected date."
      : view === "premium"
        ? "Policies where premium collection is still not complete."
        : view === "commission"
          ? "Commission rows that are still unpaid."
          : view === "missing_split"
            ? "Policies without a split pattern. These need fixing before commission is reliable."
            : "All commission rows for audit and checking, not only unpaid items.";

  return (
    <div className="crm-page">
      <header className="crm-header">
        <div className="crm-header-inner">
          <div>
            <KoverLogo size="sm" />
            <p className="crm-kicker mt-3">Daily control room</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-normal">
              <span>Operations Dashboard</span>
              <button
                aria-label={
                  hideDashboardValues ? "Show dashboard values" : "Hide dashboard values"
                }
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-white text-sky-700 shadow-sm shadow-sky-900/5 transition hover:bg-sky-50"
                onClick={() => setHideDashboardValues((current) => !current)}
                type="button"
              >
                {hideDashboardValues ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </h1>
            <p className="crm-page-subtitle">
              Renewals, unpaid work, commissions, and the latest policy movement in
              one scan.
            </p>
          </div>
          <AppMenu activeHref="/protected" path={["Dashboard"]} />
        </div>
      </header>

      <main className="crm-container flex flex-col gap-5">
        {errors.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {errors.join(" ")}
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(({ colorClass, icon, label, value }) => (
            <div
              className="crm-stat-card flex items-start gap-3"
              key={label}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorClass}`}>
                {icon}
              </span>
              <span>
                <p className="text-xs font-medium uppercase text-slate-500">
                  {label}
                </p>
                <p className="mt-2 min-h-8 text-2xl font-semibold">
                  {hideDashboardValues ? "••••" : value}
                </p>
              </span>
            </div>
          ))}
        </section>

        <section className="crm-card">
          <div className="crm-card-header flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sky-700">
                <TableProperties className="h-5 w-5" />
                <h2 className="text-lg font-semibold text-slate-950">
                  Newest Records
                </h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Latest policies added to the CRM. Use this as the quick “what changed”
                view.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                Show
                <select
                  className="crm-control h-9 px-2"
                  onChange={(event) => setNewestLimit(Number(event.target.value))}
                  value={newestLimit}
                >
                  {[5, 10, 20, 50].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <Link
                className="inline-flex h-9 items-center justify-center rounded-lg border border-sky-200 bg-white px-3 text-sm font-semibold text-sky-700 shadow-sm shadow-sky-900/5 transition hover:bg-sky-50"
                href="/protected/records"
              >
                Analyse Records
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
                <PolicyTable
                  commissionSummaryByPolicy={commissionSummaryByPolicy}
                  rows={newestPolicies}
                  setPreviewRecord={setPreviewRecord}
                  selected={selected}
              setSelected={setSelected}
            />
          </div>
        </section>

        <section className="crm-card min-w-0">
            <div className="crm-card-header flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  {viewOptions.map((option) => {
                    const Icon = option.icon;
                    const viewCount =
                      option.id === "renewals"
                        ? renewals.length
                        : option.id === "premium"
                          ? unpaidPremium.length
                          : option.id === "commission"
                            ? unpaidCommission.length
                            : option.id === "missing_split"
                              ? missingSplitPolicies.length
                              : commissions.length;
                    return (
                      <button
                        className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium ${
                          view === option.id
                            ? "bg-slate-950 text-white shadow-sm shadow-slate-900/15"
                            : "border border-slate-200 bg-white text-slate-700 shadow-sm shadow-slate-900/5 hover:bg-sky-50"
                        }`}
                        key={option.id}
                        onClick={() => setView(option.id)}
                        type="button"
                      >
                        <Icon className="h-4 w-4" />
                        {option.label}
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                            view === option.id
                              ? "bg-white/15 text-white"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {viewCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-sm text-slate-500">{activeViewDescription}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium uppercase text-slate-500">
                    Sort
                  </label>
                  <select
                    className="crm-control h-9"
                    onChange={(event) => setRecordSort(event.target.value as RecordSort)}
                    value={recordSort}
                  >
                    {recordSortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    aria-label={
                      recordSortDirection === "asc"
                        ? "Sort records descending"
                        : "Sort records ascending"
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm shadow-slate-900/5 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                    onClick={() =>
                      setRecordSortDirection((current) =>
                        current === "asc" ? "desc" : "asc",
                      )
                    }
                    type="button"
                  >
                    {recordSortDirection === "asc" ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <label className="relative block min-w-0 sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="crm-control h-9 w-full pl-9"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search client, vehicle, policy"
                    value={query}
                  />
                </label>
              </div>
            </div>

            <div className="overflow-x-auto">
              {view === "commission" ? (
                <CommissionTable
                  rows={sortedRows as CommissionRecord[]}
                  setPreviewRecord={setPreviewRecord}
                  selected={selected}
                  setSelected={setSelected}
                />
              ) : view === "commissions" ? (
                <div>
                  <CommissionSummary rows={commissionSummary} />
                  <CommissionTable
                    rows={sortedRows as CommissionRecord[]}
                    setPreviewRecord={setPreviewRecord}
                    selected={selected}
                    setSelected={setSelected}
                  />
                </div>
              ) : (
                <PolicyTable
                  commissionSummaryByPolicy={commissionSummaryByPolicy}
                  rows={sortedRows as PolicyRecord[]}
                  setPreviewRecord={setPreviewRecord}
                  selected={selected}
                  setSelected={setSelected}
                />
              )}
            </div>
        </section>
      </main>
      {previewRecord ? (
        <DashboardPreviewModal
          commissionSummaryByPolicy={commissionSummaryByPolicy}
          onClose={() => setPreviewRecord(null)}
          record={previewRecord}
        />
      ) : null}
    </div>
  );
}

function DashboardPreviewModal({
  commissionSummaryByPolicy,
  onClose,
  record,
}: {
  commissionSummaryByPolicy: Map<string, PolicyCommissionSummary>;
  onClose: () => void;
  record: PolicyRecord | CommissionRecord;
}) {
  const isCommission = isCommissionRecord(record);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4"
      onClick={onClose}
      role="presentation"
    >
      <section
        aria-modal="true"
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {isCommission ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-100">
                  <BadgeDollarSign className="h-4 w-4" />
                  Commission
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-100">
                    <RiskIcon record={record} />
                    {riskType(record)}
                  </span>
                  <StageBadge record={record} />
                </>
              )}
            </div>
            <h3 className="truncate text-xl font-semibold text-slate-950">
              {clean(record.client_name)}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {isCommission
                ? `${clean(record.payee_name)} / ${clean(record.status)}`
                : `${riskType(record)} / ${riskLabel(record)}`}
            </p>
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

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
          <PreviewGrid
            rows={
              isCommission
                ? [
                    ["Policy No", clean(record.policy_number)],
                    ["Insurance Type", clean(record.insurance_type)],
                    ["Payee", clean(record.payee_name)],
                    ["Rate", percent(record.calculation_percent)],
                    ["Amount", money(record.amount)],
                    ["Unpaid", money(record.unpaid_amount)],
                    ["Status", clean(record.status)],
                    ["Paid Date", formatDate(record.paid_date)],
                    ["Statement", clean(record.statement_no)],
                    ["Effective", formatDate(record.effective_date)],
                    ["Expiry", formatDate(record.expiry_date)],
                  ]
                : [
                    ["Policy No", clean(record.policy_number)],
                    ["Vehicle No", vehicleNo(record)],
                    ["Insurer", <InsurerBadge key="insurer" name={record.insurer_name} />],
                    ["Split", splitCode(record)],
                    [
                      "Commission",
                      <CommissionStatusBadge
                        key="commission"
                        summary={commissionSummaryByPolicy.get(record.policy_term_id)}
                      />,
                    ],
                    ["Effective", formatDate(record.effective_date)],
                    ["Expiry", formatDate(record.expiry_date)],
                    ["Sum Assured", money(record.primary_sum_assured)],
                    ["Gross Premium", money(record.gross_premium)],
                    ["Net Premium", money(record.net_premium)],
                    ["Premium", clean(record.premium_status)],
                    ["Stage", `${stageFullLabel(record)} / ${stageMeta(record)}`],
                    ["Renewal", clean(record.renewal_status)],
                    ["Type of Cover", clean(record.type_of_cover)],
                    ["Make / Model", clean(record.make_model)],
                    ["Year", clean(record.year_of_manufacture)],
                    ["Motor Type", clean(record.motor_type)],
                    ["NCD", percent(record.ncd)],
                  ]
            }
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Link
            className="inline-flex h-9 items-center justify-center rounded-lg bg-sky-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800"
            href={`/protected/policies/${record.policy_term_id}`}
          >
            View Details
          </Link>
        </div>
      </section>
    </div>
  );
}

function PreviewGrid({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  const visibleRows = rows.filter(([, value]) => value !== "-");
  const wideLabels = new Set([
    "Insurer",
    "Make / Model",
    "Type of Cover",
    "Policy No",
  ]);

  return (
    <dl className="grid grid-cols-2 gap-2 text-sm">
      {visibleRows.map(([label, value]) => {
        const isWide = wideLabels.has(label) || String(value).length > 24;

        return (
          <div
            className={`rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 ${
              isWide ? "col-span-2" : ""
            }`}
            key={label}
          >
            <dt className="text-[10px] font-semibold uppercase text-slate-500">
              {label}
            </dt>
            <dd className="mt-1 break-words font-semibold text-slate-950">
              {value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function PolicyTable({
  commissionSummaryByPolicy,
  rows,
  setPreviewRecord,
  selected,
  setSelected,
}: {
  commissionSummaryByPolicy: Map<string, PolicyCommissionSummary>;
  rows: PolicyRecord[];
  setPreviewRecord: (record: PolicyRecord) => void;
  selected: PolicyRecord | CommissionRecord | null;
  setSelected: (record: PolicyRecord) => void;
}) {
  return (
    <table className="crm-table min-w-[1120px]">
      <thead>
        <tr>
          <th className="px-3 py-2 font-medium">Effective</th>
          <th className="px-3 py-2 font-medium">Expiry</th>
          <th className="px-3 py-2 font-medium">Client</th>
          <th className="px-3 py-2 font-medium">Risk Type</th>
          <th className="px-3 py-2 font-medium">Vehicle No</th>
          <th className="px-3 py-2 font-medium">Type</th>
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
              className={`cursor-pointer ${
                selected &&
                "policy_term_id" in selected &&
                selected.policy_term_id === row.policy_term_id
                  ? "bg-sky-50"
                  : ""
              }`}
              key={row.policy_term_id}
              onClick={() => setSelected(row)}
              onDoubleClick={() => {
                window.location.href = `/protected/policies/${row.policy_term_id}`;
              }}
            >
              <td className="px-3 py-2">
                <DateBadge value={row.effective_date} />
              </td>
              <td className="px-3 py-2">
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
                  {riskType(row)}
                </span>
              </td>
              <td className="px-3 py-2">{vehicleNo(row)}</td>
              <td className="px-3 py-2">{clean(row.insurance_type)}</td>
              <td className="px-3 py-2">
                <InsurerBadge name={row.insurer_name} />
              </td>
              <td className="px-3 py-2">
                <StageBadge record={row} />
              </td>
              <td className="px-3 py-2">{splitCode(row)}</td>
              <td className="px-3 py-2">
                <CommissionStatusBadge
                  summary={commissionSummaryByPolicy.get(row.policy_term_id)}
                />
              </td>
              <td className="px-3 py-2">{money(row.gross_premium)}</td>
              <td className="px-3 py-2">
                <PremiumStatusSelect
                  policyTermId={row.policy_term_id}
                  status={row.premium_status}
                />
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td className="px-3 py-8 text-center text-zinc-500" colSpan={12}>
              No matching records.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function CommissionSummary({
  rows,
}: {
  rows: Array<[string, { amount: number; unpaid: number; count: number }]>;
}) {
  if (!rows.length) return null;

  return (
    <div className="grid gap-3 border-b border-slate-100 p-3 md:grid-cols-3">
      {rows.map(([payee, total]) => (
        <div
          className="rounded-xl border border-orange-100 bg-orange-50/60 p-3"
          key={payee}
        >
          <div className="flex items-center gap-2 text-orange-800">
            <BadgeDollarSign className="h-4 w-4" />
            <p className="font-semibold">{payee}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs uppercase text-orange-700/80">Total</p>
              <p className="font-semibold text-slate-950">{money(total.amount)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-orange-700/80">Unpaid</p>
              <p className="font-semibold text-slate-950">{money(total.unpaid)}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">{total.count} rows</p>
        </div>
      ))}
    </div>
  );
}

function CommissionTable({
  rows,
  setPreviewRecord,
  selected,
  setSelected,
}: {
  rows: CommissionRecord[];
  setPreviewRecord: (record: CommissionRecord) => void;
  selected: PolicyRecord | CommissionRecord | null;
  setSelected: (record: CommissionRecord) => void;
}) {
  return (
    <table className="crm-table min-w-[820px]">
      <thead>
        <tr>
          <th className="px-3 py-2 font-medium">Effective</th>
          <th className="px-3 py-2 font-medium">Expiry</th>
          <th className="px-3 py-2 font-medium">Client</th>
          <th className="px-3 py-2 font-medium">Type</th>
          <th className="px-3 py-2 font-medium">Policy No</th>
          <th className="px-3 py-2 font-medium">Payee</th>
          <th className="px-3 py-2 font-medium">Rate</th>
          <th className="px-3 py-2 font-medium">Amount</th>
          <th className="px-3 py-2 font-medium">Unpaid</th>
          <th className="px-3 py-2 font-medium">Status</th>
          <th className="px-3 py-2 font-medium">Statement</th>
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((row) => (
            <tr
              className={`cursor-pointer ${
                selected &&
                "commission_id" in selected &&
                selected.commission_id === row.commission_id
                  ? "bg-sky-50"
                  : ""
              }`}
              key={row.commission_id}
              onClick={() => setSelected(row)}
              onDoubleClick={() => {
                window.location.href = `/protected/policies/${row.policy_term_id}`;
              }}
            >
              <td className="px-3 py-2">
                <DateBadge value={row.effective_date} />
              </td>
              <td className="px-3 py-2">
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
                </span>
              </td>
              <td className="px-3 py-2">{clean(row.insurance_type)}</td>
              <td className="px-3 py-2">{clean(row.policy_number)}</td>
              <td className="px-3 py-2">{clean(row.payee_name)}</td>
              <td className="px-3 py-2">{percent(row.calculation_percent)}</td>
              <td className="px-3 py-2">{money(row.amount)}</td>
              <td className="px-3 py-2">{money(row.unpaid_amount)}</td>
              <td className="px-3 py-2">{clean(row.status)}</td>
              <td className="px-3 py-2">{clean(row.statement_no)}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td className="px-3 py-8 text-center text-zinc-500" colSpan={11}>
              No matching commission records.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
