"use client";

import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Car,
  ClipboardList,
  Flame,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

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
  vehicle_no: string | null;
  make_model?: string | null;
  year_of_manufacture?: number | string | null;
  motor_type: string | null;
  type_of_cover?: string | null;
  ncd: number | string | null;
  created_at?: string | null;
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
  { value: "risk_type", label: "Risk Type" },
  { value: "insurer", label: "Insurer" },
  { value: "premium_status", label: "Premium Status" },
];

const sortOptions: Array<{ value: SortBy; label: string }> = [
  { value: "created_at", label: "Newest" },
  { value: "expiry_date", label: "Expiry Date" },
  { value: "effective_date", label: "Effective Date" },
  { value: "client", label: "Client" },
  { value: "risk_type", label: "Risk Type" },
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
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
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
  if (sortBy === "risk_type") return riskType(record);
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
  if (groupBy === "risk_type") return riskType(record);
  if (groupBy === "insurer") return clean(record.insurer_name);
  if (groupBy === "premium_status") return clean(record.premium_status);
  return "All Records";
}

function uniqueOptions(records: PolicyRecord[], getValue: (record: PolicyRecord) => string) {
  return Array.from(new Set(records.map(getValue).filter((value) => value && value !== "-")))
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

export function RecordsPanel({ policies }: { policies: PolicyRecord[] }) {
  const [query, setQuery] = useState("");
  const [dateBasis, setDateBasis] = useState<DateBasis>("expiry_date");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [insurerFilter, setInsurerFilter] = useState("all");
  const [premiumFilter, setPremiumFilter] = useState("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [sortBy, setSortBy] = useState<SortBy>("expiry_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selected, setSelected] = useState<PolicyRecord | null>(policies[0] ?? null);

  function updateDateBasis(value: DateBasis) {
    setDateBasis(value);
    setSortBy(value);
  }

  const riskOptions = useMemo(
    () => uniqueOptions(policies, (record) => riskType(record)),
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

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return policies.filter((record) => {
      const date = parseDate(record[dateBasis]);
      if (!dateMatchesPeriod(date, period)) return false;
      if (riskFilter !== "all" && riskType(record) !== riskFilter) return false;
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

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sky-700">
          <ShieldCheck className="h-5 w-5" />
          <h2 className="text-lg font-semibold text-slate-950">Selected Record</h2>
        </div>
        {selected ? (
          <div className="grid gap-3 lg:grid-cols-[1.2fr_2fr_auto] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Client</p>
              <p className="mt-1 text-xl font-semibold text-slate-950">
                {clean(selected.client_name)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
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
                ["Gross", money(selected.gross_premium)],
                ["Net", money(selected.net_premium)],
                [
                  "Premium",
                  <PremiumStatusSelect
                    key="premium-status"
                    policyTermId={selected.policy_term_id}
                    status={selected.premium_status}
                  />,
                ],
                ["Renewal", clean(selected.renewal_status)],
                ["Cover", clean(selected.type_of_cover)],
                ["Make", clean(selected.make_model)],
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
        ) : (
          <p className="text-sm text-slate-500">No records yet.</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm">
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
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-950 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
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
              { value: "expiry_date", label: "Expiry Date" },
              { value: "effective_date", label: "Effective Date" },
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
            label="Risk Type"
            onChange={setRiskFilter}
            options={[
              { value: "all", label: "All Risk Types" },
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
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
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
            className="overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-sm"
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
              <PolicyTable rows={rows} selected={selected} setSelected={setSelected} />
            </div>
          </div>
        ))}
      </section>
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
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
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

function PolicyTable({
  rows,
  selected,
  setSelected,
}: {
  rows: PolicyRecord[];
  selected: PolicyRecord | null;
  setSelected: (record: PolicyRecord) => void;
}) {
  return (
    <table className="w-full min-w-[1040px] text-left text-sm">
      <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          <th className="px-3 py-3 font-medium">Client</th>
          <th className="px-3 py-3 font-medium">Risk Type</th>
          <th className="px-3 py-3 font-medium">Vehicle No</th>
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
              className={`cursor-pointer border-b border-slate-100 transition hover:bg-sky-50/60 ${
                selected?.policy_term_id === row.policy_term_id ? "bg-sky-50" : ""
              }`}
              key={row.policy_term_id}
              onClick={() => setSelected(row)}
              onDoubleClick={() => {
                window.location.href = `/protected/policies/${row.policy_term_id}`;
              }}
            >
              <td className="px-3 py-3 font-medium text-slate-950">
                {clean(row.client_name)}
              </td>
              <td className="px-3 py-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
                  <RiskIcon record={row} />
                  {riskType(row)}
                </span>
              </td>
              <td className="px-3 py-3 text-slate-700">{vehicleNo(row)}</td>
              <td className="px-3 py-3 text-slate-700">{clean(row.policy_number)}</td>
              <td className="px-3 py-3 text-slate-700">{clean(row.insurer_name)}</td>
              <td className="px-3 py-3 text-slate-700">
                {formatDate(row.effective_date)}
              </td>
              <td className="px-3 py-3 text-slate-700">{formatDate(row.expiry_date)}</td>
              <td className="px-3 py-3 text-slate-700">{money(row.gross_premium)}</td>
              <td className="px-3 py-3 text-slate-700">
                <PremiumStatusSelect
                  policyTermId={row.policy_term_id}
                  status={row.premium_status}
                />
              </td>
              <td className="px-3 py-3 text-slate-700">{clean(row.renewal_status)}</td>
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
            <td className="px-3 py-8 text-center text-slate-500" colSpan={11}>
              No matching records.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
