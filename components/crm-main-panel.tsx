"use client";

import {
  ArrowDown,
  ArrowUp,
  BadgeDollarSign,
  CalendarDays,
  Car,
  CircleDollarSign,
  ClipboardList,
  Eye,
  EyeOff,
  FileText,
  Flame,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  TableProperties,
  Users,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

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

type ViewMode = "renewals" | "premium" | "commission" | "commissions";
type SortDirection = "asc" | "desc";
type RecordSort =
  | "expiry_month"
  | "effective_month"
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
  { id: "commissions", label: "Commissions", icon: BadgeDollarSign },
];

const recordSortOptions: Array<{ value: RecordSort; label: string }> = [
  { value: "expiry_month", label: "Expiry Month" },
  { value: "effective_month", label: "Effective Month" },
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
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function clean(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replaceAll("_", " ");
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

function monthKey(value: string | null | undefined) {
  return value ? value.slice(0, 7) : "";
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
      className={`inline-flex min-w-24 items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        isQuotation
          ? "bg-orange-50 text-orange-800 ring-1 ring-orange-200"
          : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
      }`}
    >
      {stageLabel(record)}
    </span>
  );
}

function isCommissionRecord(
  record: PolicyRecord | CommissionRecord,
): record is CommissionRecord {
  return "commission_id" in record;
}

function recordSortValue(record: PolicyRecord | CommissionRecord, sort: RecordSort) {
  if (sort === "expiry_month") return monthKey(record.expiry_date);
  if (sort === "effective_month") return monthKey(record.effective_date);
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
  const [recordSort, setRecordSort] = useState<RecordSort>("expiry_month");
  const [recordSortDirection, setRecordSortDirection] = useState<SortDirection>("asc");
  const [selected, setSelected] = useState<PolicyRecord | CommissionRecord | null>(
    policies[0] || renewals[0] || unpaidPremium[0] || unpaidCommission[0] || null,
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
            : commissions;

    if (!q) return rows;

    return rows.filter((row) =>
      Object.values(row).some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [commissions, query, renewals, unpaidCommission, unpaidPremium, view]);

  const sortedRows = useMemo(() => {
    const multiplier = sortMultiplier(recordSortDirection);
    return [...activeRows].sort((a, b) => {
      const result = compareValues(
        recordSortValue(a, recordSort),
        recordSortValue(b, recordSort),
      );
      return result * multiplier;
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
        label: "Documents",
        value: count(summary?.document_attention_count),
        numericValue: toNumber(summary?.document_attention_count),
        icon: <FileText className="h-5 w-5" />,
        colorClass: "text-slate-700 bg-slate-50",
        order: 7,
      },
      {
        label: "Tasks Due",
        value: count(summary?.tasks_due_today_count),
        numericValue: toNumber(summary?.tasks_due_today_count),
        icon: <ClipboardList className="h-5 w-5" />,
        colorClass: "text-cyan-700 bg-cyan-50",
        order: 8,
      },
    ],
    [summary],
  );

  const newestPolicies = useMemo(
    () =>
      [...policies]
        .sort((a, b) =>
          String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
        )
        .slice(0, 8),
    [policies],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-950">
      <header className="border-b border-sky-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-sky-700">
              Insurance CRM
            </p>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-normal">
              <span>Operations Dashboard</span>
              <button
                aria-label={
                  hideDashboardValues ? "Show dashboard values" : "Hide dashboard values"
                }
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-white text-sky-700 shadow-sm transition hover:bg-sky-50"
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
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 text-sm font-medium text-sky-700 shadow-sm"
              href="/protected/records"
            >
              <TableProperties className="h-4 w-4" />
              Records
            </Link>
            <Link
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 text-sm font-medium text-sky-700 shadow-sm"
              href="/protected/clients"
            >
              <Users className="h-4 w-4" />
              Clients
            </Link>
            <Link
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 text-sm font-medium text-sky-700 shadow-sm"
              href="/protected/settings"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <Link
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-sky-600 px-3 text-sm font-medium text-white shadow-sm"
              href="/protected/new-policy"
            >
              <FileText className="h-4 w-4" />
              New Policy
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5">
        {errors.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {errors.join(" ")}
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(({ colorClass, icon, label, value }) => (
            <div
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm"
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

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sky-700">
                <TableProperties className="h-5 w-5" />
                <h2 className="text-lg font-semibold text-slate-950">
                  Newest Records
                </h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Latest policies added to the CRM.
              </p>
            </div>
            <Link
              className="inline-flex h-9 items-center justify-center rounded-lg border border-sky-200 bg-white px-3 text-sm font-semibold text-sky-700 shadow-sm"
              href="/protected/records"
            >
              Analyse Records
            </Link>
          </div>
          <div className="overflow-x-auto">
            <PolicyTable
              rows={newestPolicies}
              selected={selected}
              setSelected={setSelected}
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-emerald-700">
              Preview
            </p>
            {selected ? (
              "payee_name" in selected ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
                      <BadgeDollarSign className="h-5 w-5" />
                    </span>
                    <h2 className="text-xl font-semibold">{clean(selected.client_name)}</h2>
                    <p className="text-sm text-slate-500">
                      {clean(selected.insurance_type)} commission
                    </p>
                  </div>
                  <PreviewGrid
                    rows={[
                      ["Payee", clean(selected.payee_name)],
                      ["Policy No", clean(selected.policy_number)],
                      ["Amount", money(selected.amount)],
                      ["Unpaid", money(selected.unpaid_amount)],
                      ["Status", clean(selected.status)],
                      ["Expiry", formatDate(selected.expiry_date)],
                    ]}
                  />
                  <Link
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-sky-600 px-3 text-sm font-semibold text-white shadow-sm"
                    href={`/protected/policies/${selected.policy_term_id}`}
                  >
                    Open Record
                  </Link>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div>
                    <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                      <RiskIcon record={selected} />
                    </span>
                    <h2 className="text-xl font-semibold">
                      {clean(selected.client_name)}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {riskType(selected)} / {riskLabel(selected)}
                    </p>
                  </div>
                  <PreviewGrid
                    rows={[
                      ["Policy No", clean(selected.policy_number)],
                      ["Vehicle No", vehicleNo(selected)],
                      ["Insurer", clean(selected.insurer_name)],
                      ["Effective", formatDate(selected.effective_date)],
                      ["Expiry", formatDate(selected.expiry_date)],
                      ["Sum Assured", money(selected.primary_sum_assured)],
                      ["Gross Premium", money(selected.gross_premium)],
                      ["Net Premium", money(selected.net_premium)],
                      [
                        "Premium",
                        <PremiumStatusSelect
                          key="premium-status"
                          policyTermId={selected.policy_term_id}
                          status={selected.premium_status}
                        />,
                      ],
                      ["Stage", clean(selected.term_stage)],
                      ["Renewal", clean(selected.renewal_status)],
                      ["Type of Cover", clean(selected.type_of_cover)],
                      ["Make / Model", clean(selected.make_model)],
                      ["Year", clean(selected.year_of_manufacture)],
                      ["Motor Type", clean(selected.motor_type)],
                      ["NCD", percent(selected.ncd)],
                    ]}
                  />
                  <Link
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-sky-600 px-3 text-sm font-semibold text-white shadow-sm"
                    href={`/protected/policies/${selected.policy_term_id}`}
                  >
                    Open Record
                  </Link>
                </div>
              )
            ) : (
              <p className="mt-4 text-sm text-slate-500">No records yet.</p>
            )}
          </aside>

          <section className="min-w-0 rounded-xl border border-slate-200 bg-white/95 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {viewOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium ${
                        view === option.id
                          ? "bg-emerald-600 text-white"
                          : "border border-slate-200 bg-white text-slate-700"
                      }`}
                      key={option.id}
                      onClick={() => setView(option.id)}
                      type="button"
                    >
                      <Icon className="h-4 w-4" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium uppercase text-slate-500">
                    Sort
                  </label>
                  <select
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
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
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
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
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
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
                  selected={selected}
                  setSelected={setSelected}
                />
              ) : view === "commissions" ? (
                <div>
                  <CommissionSummary rows={commissionSummary} />
                  <CommissionTable
                    rows={sortedRows as CommissionRecord[]}
                    selected={selected}
                    setSelected={setSelected}
                  />
                </div>
              ) : (
                <PolicyTable
                  rows={sortedRows as PolicyRecord[]}
                  selected={selected}
                  setSelected={setSelected}
                />
              )}
            </div>
          </section>
        </section>
      </main>
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
  rows,
  selected,
  setSelected,
}: {
  rows: PolicyRecord[];
  selected: PolicyRecord | CommissionRecord | null;
  setSelected: (record: PolicyRecord) => void;
}) {
  return (
    <table className="w-full min-w-[980px] text-left text-sm">
      <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
        <tr>
          <th className="px-3 py-3 font-medium">Client</th>
          <th className="px-3 py-3 font-medium">Risk Type</th>
          <th className="px-3 py-3 font-medium">Vehicle No</th>
          <th className="px-3 py-3 font-medium">Type</th>
          <th className="px-3 py-3 font-medium">Policy No</th>
          <th className="px-3 py-3 font-medium">Insurer</th>
          <th className="px-3 py-3 font-medium">Effective</th>
          <th className="px-3 py-3 font-medium">Expiry</th>
          <th className="px-3 py-3 font-medium">Stage</th>
          <th className="px-3 py-3 font-medium">Gross</th>
          <th className="px-3 py-3 font-medium">Premium</th>
          <th className="px-3 py-3 font-medium">Renewal</th>
          <th className="px-3 py-3 font-medium">Open</th>
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((row) => (
            <tr
              className={`cursor-pointer border-b border-zinc-100 hover:bg-zinc-50 ${
                selected &&
                "policy_term_id" in selected &&
                selected.policy_term_id === row.policy_term_id
                  ? "bg-zinc-50"
                  : ""
              }`}
              key={row.policy_term_id}
              onClick={() => setSelected(row)}
              onDoubleClick={() => {
                window.location.href = `/protected/policies/${row.policy_term_id}`;
              }}
            >
              <td className="px-3 py-3 font-medium">{clean(row.client_name)}</td>
              <td className="px-3 py-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
                  <RiskIcon record={row} />
                  {riskType(row)}
                </span>
              </td>
              <td className="px-3 py-3">{vehicleNo(row)}</td>
              <td className="px-3 py-3">{clean(row.insurance_type)}</td>
              <td className="px-3 py-3">{clean(row.policy_number)}</td>
              <td className="px-3 py-3">{clean(row.insurer_name)}</td>
              <td className="px-3 py-3">{formatDate(row.effective_date)}</td>
              <td className="px-3 py-3">{formatDate(row.expiry_date)}</td>
              <td className="px-3 py-3">
                <StageBadge record={row} />
                <p className="mt-1 text-xs text-slate-500">{stageMeta(row)}</p>
              </td>
              <td className="px-3 py-3">{money(row.gross_premium)}</td>
              <td className="px-3 py-3">
                <PremiumStatusSelect
                  policyTermId={row.policy_term_id}
                  status={row.premium_status}
                />
              </td>
              <td className="px-3 py-3">{clean(row.renewal_status)}</td>
              <td className="px-3 py-3">
                <Link
                  className="font-medium text-sky-700 hover:text-sky-900"
                  href={`/protected/policies/${row.policy_term_id}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  Open
                </Link>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td className="px-3 py-8 text-center text-zinc-500" colSpan={13}>
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
  selected,
  setSelected,
}: {
  rows: CommissionRecord[];
  selected: PolicyRecord | CommissionRecord | null;
  setSelected: (record: CommissionRecord) => void;
}) {
  return (
    <table className="w-full min-w-[860px] text-left text-sm">
      <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
        <tr>
          <th className="px-3 py-3 font-medium">Client</th>
          <th className="px-3 py-3 font-medium">Type</th>
          <th className="px-3 py-3 font-medium">Policy No</th>
          <th className="px-3 py-3 font-medium">Payee</th>
          <th className="px-3 py-3 font-medium">Rate</th>
          <th className="px-3 py-3 font-medium">Amount</th>
          <th className="px-3 py-3 font-medium">Unpaid</th>
          <th className="px-3 py-3 font-medium">Status</th>
          <th className="px-3 py-3 font-medium">Open</th>
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((row) => (
            <tr
              className={`cursor-pointer border-b border-zinc-100 hover:bg-zinc-50 ${
                selected &&
                "commission_id" in selected &&
                selected.commission_id === row.commission_id
                  ? "bg-zinc-50"
                  : ""
              }`}
              key={row.commission_id}
              onClick={() => setSelected(row)}
              onDoubleClick={() => {
                window.location.href = `/protected/policies/${row.policy_term_id}`;
              }}
            >
              <td className="px-3 py-3 font-medium">{clean(row.client_name)}</td>
              <td className="px-3 py-3">{clean(row.insurance_type)}</td>
              <td className="px-3 py-3">{clean(row.policy_number)}</td>
              <td className="px-3 py-3">{clean(row.payee_name)}</td>
              <td className="px-3 py-3">{percent(row.calculation_percent)}</td>
              <td className="px-3 py-3">{money(row.amount)}</td>
              <td className="px-3 py-3">{money(row.unpaid_amount)}</td>
              <td className="px-3 py-3">{clean(row.status)}</td>
              <td className="px-3 py-3">
                <Link
                  className="font-medium text-sky-700 hover:text-sky-900"
                  href={`/protected/policies/${row.policy_term_id}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  Open
                </Link>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td className="px-3 py-8 text-center text-zinc-500" colSpan={9}>
              No matching commission records.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
