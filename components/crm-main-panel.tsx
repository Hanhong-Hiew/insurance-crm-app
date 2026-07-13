"use client";

import {
  CalendarDays,
  Car,
  FileText,
  LayoutDashboard,
  ReceiptText,
  Search,
  Settings,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";

type PolicyRecord = {
  policy_term_id: string;
  policy_series_id: string;
  client_id: string;
  client_name: string | null;
  insurance_type: string | null;
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
  motor_type: string | null;
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

type ViewMode = "all" | "renewals" | "premium" | "commission";

type CrmMainPanelProps = {
  summary: DashboardSummary | null;
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
  return record.vehicle_no || record.primary_risk_label || record.policy_number || "-";
}

export function CrmMainPanel({
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
            : policies;

    if (!q) return rows;

    return rows.filter((row) =>
      Object.values(row).some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [policies, query, renewals, unpaidCommission, unpaidPremium, view]);

  const metrics = [
    ["Active Policies", count(summary?.active_policy_count)],
    ["Clients", count(summary?.client_count)],
    ["Renewals 60 Days", count(summary?.renewals_due_60_days)],
    ["Gross Premium", money(summary?.active_gross_premium_total)],
    ["Unpaid Premium", money(summary?.unpaid_premium_total)],
    ["Unpaid Commission", money(summary?.unpaid_commission_total)],
    ["Documents", count(summary?.document_attention_count)],
    ["Tasks Due", count(summary?.tasks_due_today_count)],
  ];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-zinc-500">
              Insurance CRM
            </p>
            <h1 className="text-2xl font-semibold tracking-normal">
              Operations Dashboard
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium">
              <Settings className="h-4 w-4" />
              Settings
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-medium text-white">
              <FileText className="h-4 w-4" />
              New Policy
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5">
        {errors.length > 0 ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {errors.join(" ")}
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(([label, value]) => (
            <div
              className="rounded-md border border-zinc-200 bg-white p-4"
              key={label}
            >
              <p className="text-xs font-medium uppercase text-zinc-500">
                {label}
              </p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-md border border-zinc-200 bg-white p-4">
            <p className="text-xs font-medium uppercase text-zinc-500">
              Preview
            </p>
            {selected ? (
              "payee_name" in selected ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {clean(selected.client_name)}
                    </h2>
                    <p className="text-sm text-zinc-500">
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
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {clean(selected.client_name)}
                    </h2>
                    <p className="text-sm text-zinc-500">
                      {clean(selected.insurance_type)} / {riskLabel(selected)}
                    </p>
                  </div>
                  <PreviewGrid
                    rows={[
                      ["Policy No", clean(selected.policy_number)],
                      ["Insurer", clean(selected.insurer_name)],
                      ["Effective", formatDate(selected.effective_date)],
                      ["Expiry", formatDate(selected.expiry_date)],
                      ["Sum Assured", money(selected.primary_sum_assured)],
                      ["Gross Premium", money(selected.gross_premium)],
                      ["Net Premium", money(selected.net_premium)],
                      ["Premium", clean(selected.premium_status)],
                      ["Stage", clean(selected.term_stage)],
                      ["Renewal", clean(selected.renewal_status)],
                      ["Motor Type", clean(selected.motor_type)],
                      ["NCD", percent(selected.ncd)],
                    ]}
                  />
                </div>
              )
            ) : (
              <p className="mt-4 text-sm text-zinc-500">No records yet.</p>
            )}
          </aside>

          <section className="min-w-0 rounded-md border border-zinc-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-zinc-200 p-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {viewOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium ${
                        view === option.id
                          ? "bg-zinc-950 text-white"
                          : "border border-zinc-300 bg-white text-zinc-700"
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
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  className="h-9 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-600"
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
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-medium uppercase text-zinc-500">{label}</dt>
          <dd className="mt-1 font-medium text-zinc-900">{value}</dd>
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
          <th className="px-3 py-3 font-medium">Risk</th>
          <th className="px-3 py-3 font-medium">Type</th>
          <th className="px-3 py-3 font-medium">Policy No</th>
          <th className="px-3 py-3 font-medium">Insurer</th>
          <th className="px-3 py-3 font-medium">Effective</th>
          <th className="px-3 py-3 font-medium">Expiry</th>
          <th className="px-3 py-3 font-medium">Gross</th>
          <th className="px-3 py-3 font-medium">Premium</th>
          <th className="px-3 py-3 font-medium">Renewal</th>
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
              onDoubleClick={() => setSelected(row)}
            >
              <td className="px-3 py-3 font-medium">{clean(row.client_name)}</td>
              <td className="px-3 py-3">
                <span className="inline-flex items-center gap-2">
                  {row.vehicle_no ? <Car className="h-4 w-4 text-zinc-500" /> : null}
                  {riskLabel(row)}
                </span>
              </td>
              <td className="px-3 py-3">{clean(row.insurance_type)}</td>
              <td className="px-3 py-3">{clean(row.policy_number)}</td>
              <td className="px-3 py-3">{clean(row.insurer_name)}</td>
              <td className="px-3 py-3">{formatDate(row.effective_date)}</td>
              <td className="px-3 py-3">{formatDate(row.expiry_date)}</td>
              <td className="px-3 py-3">{money(row.gross_premium)}</td>
              <td className="px-3 py-3">{clean(row.premium_status)}</td>
              <td className="px-3 py-3">{clean(row.renewal_status)}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td className="px-3 py-8 text-center text-zinc-500" colSpan={10}>
              No matching records.
            </td>
          </tr>
        )}
      </tbody>
    </table>
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
              onDoubleClick={() => setSelected(row)}
            >
              <td className="px-3 py-3 font-medium">{clean(row.client_name)}</td>
              <td className="px-3 py-3">{clean(row.insurance_type)}</td>
              <td className="px-3 py-3">{clean(row.policy_number)}</td>
              <td className="px-3 py-3">{clean(row.payee_name)}</td>
              <td className="px-3 py-3">{percent(row.calculation_percent)}</td>
              <td className="px-3 py-3">{money(row.amount)}</td>
              <td className="px-3 py-3">{money(row.unpaid_amount)}</td>
              <td className="px-3 py-3">{clean(row.status)}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td className="px-3 py-8 text-center text-zinc-500" colSpan={8}>
              No matching commission records.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
