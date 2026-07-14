"use client";

import {
  BadgeDollarSign,
  CalendarDays,
  Car,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Flame,
  LayoutDashboard,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

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

type ViewMode = "all" | "renewals" | "premium" | "commission" | "commissions";

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
  { id: "all", label: "All Records", icon: LayoutDashboard },
  { id: "renewals", label: "Renewals", icon: CalendarDays },
  { id: "premium", label: "Unpaid Premium", icon: ReceiptText },
  { id: "commission", label: "Unpaid Commission", icon: WalletCards },
  { id: "commissions", label: "Commissions", icon: BadgeDollarSign },
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

export function CrmMainPanel({
  commissions,
  summary,
  policies,
  renewals,
  unpaidPremium,
  unpaidCommission,
  errors,
}: CrmMainPanelProps) {
  const [view, setView] = useState<ViewMode>("all");
  const [query, setQuery] = useState("");
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
            : view === "commissions"
              ? commissions
            : policies;

    if (!q) return rows;

    return rows.filter((row) =>
      Object.values(row).some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [commissions, policies, query, renewals, unpaidCommission, unpaidPremium, view]);

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

  const metrics: Array<[string, string, React.ReactNode, string]> = [
    ["Active Policies", count(summary?.active_policy_count), <FileText className="h-5 w-5" key="policies" />, "text-sky-700 bg-sky-50"],
    ["Clients", count(summary?.client_count), <Users className="h-5 w-5" key="clients" />, "text-emerald-700 bg-emerald-50"],
    ["Renewals 60 Days", count(summary?.renewals_due_60_days), <CalendarDays className="h-5 w-5" key="renewals" />, "text-amber-700 bg-amber-50"],
    ["Gross Premium", money(summary?.active_gross_premium_total), <CircleDollarSign className="h-5 w-5" key="gross" />, "text-violet-700 bg-violet-50"],
    ["Unpaid Premium", money(summary?.unpaid_premium_total), <ReceiptText className="h-5 w-5" key="premium" />, "text-red-700 bg-red-50"],
    ["Unpaid Commission", money(summary?.unpaid_commission_total), <WalletCards className="h-5 w-5" key="commission" />, "text-orange-700 bg-orange-50"],
    ["Documents", count(summary?.document_attention_count), <FileText className="h-5 w-5" key="documents" />, "text-slate-700 bg-slate-50"],
    ["Tasks Due", count(summary?.tasks_due_today_count), <ClipboardList className="h-5 w-5" key="tasks" />, "text-cyan-700 bg-cyan-50"],
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-950">
      <header className="border-b border-sky-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-sky-700">
              Insurance CRM
            </p>
            <h1 className="text-2xl font-semibold tracking-normal">
              Operations Dashboard
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
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
          {metrics.map(([label, value, icon, colorClass]) => (
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
                <p className="mt-2 text-2xl font-semibold">{value}</p>
              </span>
            </div>
          ))}
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
                      ["Premium", clean(selected.premium_status)],
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
              <label className="relative block min-w-0 lg:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search client, vehicle, policy"
                  value={query}
                />
              </label>
            </div>

            <div className="overflow-x-auto">
              {view === "commission" ? (
                <CommissionTable
                  rows={activeRows as CommissionRecord[]}
                  selected={selected}
                  setSelected={setSelected}
                />
              ) : view === "commissions" ? (
                <div>
                  <CommissionSummary rows={commissionSummary} />
                  <CommissionTable
                    rows={activeRows as CommissionRecord[]}
                    selected={selected}
                    setSelected={setSelected}
                  />
                </div>
              ) : (
                <PolicyTable
                  rows={activeRows as PolicyRecord[]}
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

function PreviewGrid({ rows }: { rows: Array<[string, string]> }) {
  const visibleRows = rows.filter(([, value]) => value !== "-");

  return (
    <dl className="grid gap-2 text-sm">
      {visibleRows.map(([label, value]) => (
        <div
          className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
          key={label}
        >
          <dt className="text-[11px] font-semibold uppercase text-slate-500">{label}</dt>
          <dd className="mt-1 font-semibold text-slate-950">{value}</dd>
        </div>
      ))}
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
              <td className="px-3 py-3">{money(row.gross_premium)}</td>
              <td className="px-3 py-3">{clean(row.premium_status)}</td>
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
