"use client";

import { Download, Eye, Search } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  confirmCommissionPayment,
  type CommissionPaymentState,
} from "@/app/protected/commission-payments/actions";
import { ActionMessage } from "@/components/action-message";
import { InsurerBadge } from "@/components/insurer-badge";
import {
  downloadCommissionStatementPdf,
  downloadCommissionStatementsPdf,
} from "@/lib/commission-statement-pdf";

export type CommissionPaymentRow = {
  amount: number | string | null;
  calculation_percent: number | string | null;
  client_name: string | null;
  commission_id: string;
  effective_date: string | null;
  expiry_date: string | null;
  gross_premium: number | string | null;
  insurer_name: string | null;
  insurance_type: string | null;
  payee_id: string;
  payee_name: string | null;
  policy_number: string | null;
  status: string | null;
  unpaid_amount: number | string | null;
  vehicle_no: string | null;
};

type DateSort = "effective_asc" | "effective_desc" | "expiry_asc" | "expiry_desc";

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
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
  return `${(amount * 100).toFixed(2)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB").format(parsed);
}

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isoToDisplayDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function displayDateToIso(value: string) {
  const match = value.trim().match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
  if (!match) return "";

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year =
    match[3].length === 2
      ? Number(match[3]) >= 70
        ? `19${match[3]}`
        : `20${match[3]}`
      : match[3];
  const parsed = new Date(`${year}-${month}-${day}T00:00:00`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() + 1 !== Number(month) ||
    parsed.getDate() !== Number(day)
  ) {
    return "";
  }
  return `${year}-${month}-${day}`;
}

function dateTime(value: string | null | undefined) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime();
}

function clean(value: string | null | undefined) {
  return value || "-";
}

function sortRowsByDate(rows: CommissionPaymentRow[], sort: DateSort) {
  return [...rows].sort((a, b) => {
    const field = sort.startsWith("expiry") ? "expiry_date" : "effective_date";
    const direction = sort.endsWith("desc") ? -1 : 1;
    const first = dateTime(a[field]);
    const second = dateTime(b[field]);
    if (first !== second) return (first - second) * direction;
    return clean(a.client_name).localeCompare(clean(b.client_name));
  });
}

function PolicyCell({
  compact = false,
  row,
}: {
  compact?: boolean;
  row: CommissionPaymentRow;
}) {
  return (
    <div className="grid gap-0.5">
      <span className={compact ? "font-medium text-slate-900" : ""}>
        {clean(row.policy_number)}
      </span>
      {row.vehicle_no ? (
        <span className="text-xs text-slate-500">{row.vehicle_no}</span>
      ) : null}
    </div>
  );
}

function TermDateCell({ row }: { row: CommissionPaymentRow }) {
  return (
    <div className="grid gap-0.5 leading-tight">
      <span>{formatDate(row.effective_date)}</span>
      <span className="text-xs text-slate-500">{formatDate(row.expiry_date)}</span>
    </div>
  );
}

function toStatementPdfRows(rows: CommissionPaymentRow[]) {
  return rows.map((row) => ({
    amount: row.unpaid_amount || row.amount,
    calculation_percent: row.calculation_percent,
    client_name: row.client_name,
    effective_date: row.effective_date,
    expiry_date: row.expiry_date,
    gross_premium: row.gross_premium,
    insurer_name: row.insurer_name,
    insurance_type: row.insurance_type,
    policy_number: row.policy_number,
    vehicle_no: row.vehicle_no,
  }));
}

export function CommissionPaymentsPanel({
  rows,
}: {
  rows: CommissionPaymentRow[];
}) {
  const [state, formAction] = useActionState<CommissionPaymentState, FormData>(
    confirmCommissionPayment,
    {},
  );
  const [query, setQuery] = useState("");
  const [dateSort, setDateSort] = useState<DateSort>("effective_asc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [paidDate, setPaidDate] = useState(localIsoDate());
  const [paidDateText, setPaidDateText] = useState(() => isoToDisplayDate(localIsoDate()));
  const [notes, setNotes] = useState("");
  const selectedRows = useMemo(
    () =>
      sortRowsByDate(
        rows.filter((row) => selectedIds.includes(row.commission_id)),
        "effective_asc",
      ),
    [rows, selectedIds],
  );
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchedRows = q
      ? rows.filter((row) =>
          [
            row.client_name,
            row.insurer_name,
            row.policy_number,
            row.vehicle_no,
            row.insurance_type,
            row.payee_name,
          ].some((value) => String(value ?? "").toLowerCase().includes(q)),
        )
      : rows;

    return sortRowsByDate(matchedRows, dateSort);
  }, [dateSort, query, rows]);
  const filteredIds = useMemo(
    () => filteredRows.map((row) => row.commission_id),
    [filteredRows],
  );
  const selectedFilteredCount = filteredIds.filter((id) =>
    selectedIds.includes(id),
  ).length;
  const allFilteredSelected =
    filteredIds.length > 0 && selectedFilteredCount === filteredIds.length;
  const someFilteredSelected =
    selectedFilteredCount > 0 && selectedFilteredCount < filteredIds.length;
  const selectAllRef = useRef<HTMLInputElement>(null);
  const statementGroups = useMemo(() => {
    const groups = new Map<string, CommissionPaymentRow[]>();
    for (const row of selectedRows) {
      groups.set(row.payee_id, [...(groups.get(row.payee_id) ?? []), row]);
    }
    return Array.from(groups.values());
  }, [selectedRows]);

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id],
    );
  }

  function toggleFilteredRows() {
    setSelectedIds((current) => {
      if (allFilteredSelected) {
        return current.filter((id) => !filteredIds.includes(id));
      }

      return Array.from(new Set([...current, ...filteredIds]));
    });
  }

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someFilteredSelected;
    }
  }, [someFilteredSelected]);

  function downloadAllStatements() {
    downloadCommissionStatementsPdf(
      statementGroups.map((rows) => {
        const sortedRows = sortRowsByDate(rows, "effective_asc");
        return {
          paidDate,
          payeeName: clean(sortedRows[0]?.payee_name),
          rows: toStatementPdfRows(sortedRows),
        };
      }),
    );
  }

  function updatePaidDate(value: string) {
    setPaidDateText(value);
    setPaidDate(displayDateToIso(value));
  }

  function normalisePaidDate() {
    const iso = displayDateToIso(paidDateText);
    if (iso) {
      setPaidDate(iso);
      setPaidDateText(isoToDisplayDate(iso));
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      <ActionMessage message={state.error} tone="error" />
      <ActionMessage message={state.success} tone="success" />

      {selectedIds.map((id) => (
        <input key={id} name="commission_id" type="hidden" value={id} />
      ))}
      <input name="paid_date" type="hidden" value={paidDate} />

      <section className="crm-panel print:hidden">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_1fr_auto_auto] lg:items-end">
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Search
            </span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="crm-control w-full pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Client, insurer, policy, vehicle, payee"
                value={query}
              />
            </span>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Sort Date
            </span>
            <select
              className="crm-control w-full"
              onChange={(event) => setDateSort(event.target.value as DateSort)}
              value={dateSort}
            >
              <option value="effective_asc">Effective oldest first</option>
              <option value="effective_desc">Effective newest first</option>
              <option value="expiry_asc">Expiry oldest first</option>
              <option value="expiry_desc">Expiry newest first</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Paid Date
            </span>
            <input
              className="crm-control w-full"
              inputMode="numeric"
              onBlur={normalisePaidDate}
              onChange={(event) => updatePaidDate(event.target.value)}
              placeholder="dd/mm/yyyy"
              type="text"
              value={paidDateText}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Notes
            </span>
            <input
              className="crm-control w-full"
              name="notes"
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Payment reference or note"
              value={notes}
            />
          </label>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-white px-4 text-sm font-semibold text-sky-700 shadow-sm shadow-sky-900/5 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!selectedRows.length}
            onClick={downloadAllStatements}
            type="button"
          >
            <Download className="h-4 w-4" />
            Download All PDF
          </button>
          <ConfirmButton disabled={!selectedRows.length} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]">
        <div className="crm-card print:hidden">
          <div className="crm-card-header">
            <h2 className="font-semibold text-slate-950">Unpaid Commissions</h2>
            <p className="text-sm text-slate-500">
              Tick rows, check the statement preview, then confirm payment.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr>
                  <th className="px-3 py-3">
                    <input
                      aria-label="Select all visible commissions"
                      checked={allFilteredSelected}
                      disabled={!filteredIds.length}
                      onChange={toggleFilteredRows}
                      ref={selectAllRef}
                      title="Select all visible rows"
                      type="checkbox"
                    />
                  </th>
                  <th className="px-3 py-3">Payee</th>
                  <th className="px-3 py-3">Client</th>
                  <th className="px-3 py-3">Insurer</th>
                  <th className="px-3 py-3">Policy</th>
                  <th className="px-3 py-3">Term</th>
                  <th className="px-3 py-3 text-right">Unpaid</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.commission_id}>
                    <td className="px-3 py-3">
                      <input
                        checked={selectedIds.includes(row.commission_id)}
                        onChange={() => toggleSelected(row.commission_id)}
                        type="checkbox"
                      />
                    </td>
                    <td className="px-3 py-3">{clean(row.payee_name)}</td>
                    <td className="px-3 py-3">{clean(row.client_name)}</td>
                    <td className="px-3 py-3">
                      <InsurerBadge name={row.insurer_name} />
                    </td>
                    <td className="px-3 py-3">
                      <PolicyCell row={row} />
                    </td>
                    <td className="px-3 py-3">
                      <TermDateCell row={row} />
                    </td>
                    <td className="px-3 py-3 text-right font-semibold">
                      {money(row.unpaid_amount || row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <StatementPreview
          paidDate={paidDate}
          statementGroups={statementGroups}
        />
      </section>
    </form>
  );
}

function StatementPreview({
  paidDate,
  statementGroups,
}: {
  paidDate: string;
  statementGroups: CommissionPaymentRow[][];
}) {
  if (!statementGroups.length) {
    return (
      <section className="rounded-xl border border-dashed border-slate-300 bg-white/80 p-5 text-sm text-slate-500 print:hidden">
        <Eye className="mb-3 h-5 w-5 text-sky-700" />
        Select commissions to preview statements.
      </section>
    );
  }

  return (
    <section className="space-y-4 xl:max-w-[40vw]">
      {statementGroups.map((rows) => {
        const sortedRows = sortRowsByDate(rows, "effective_asc");
        const payeeName = clean(rows[0]?.payee_name);
        const total = rows.reduce(
          (sum, row) => sum + toNumber(row.unpaid_amount || row.amount),
          0,
        );
        return (
          <article
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:break-after-page print:shadow-none"
            key={rows[0]?.payee_id}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase text-sky-700">Kover</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">
                  Commission Statement
                </h2>
                <p className="mt-1 text-sm text-slate-500">Payee: {payeeName}</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold text-slate-950">{formatDate(paidDate)}</p>
                <p className="text-slate-500">Draft preview</p>
                <button
                  className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-white px-3 text-xs font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50 print:hidden"
                  onClick={() =>
                    downloadCommissionStatementPdf({
                      paidDate,
                      payeeName,
                      rows: toStatementPdfRows(sortedRows),
                    })
                  }
                  type="button"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </button>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th className="px-2 py-2">No</th>
                    <th className="px-2 py-2">Client</th>
                    <th className="px-2 py-2">Policy</th>
                    <th className="px-2 py-2">Risk</th>
                    <th className="px-2 py-2">Insurer</th>
                    <th className="px-2 py-2">Term</th>
                    <th className="px-2 py-2 text-right">Gross</th>
                    <th className="px-2 py-2 text-right">%</th>
                    <th className="px-2 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row, index) => (
                    <tr key={row.commission_id}>
                      <td className="px-2 py-2 text-slate-500">{index + 1}</td>
                      <td className="px-2 py-2">{clean(row.client_name)}</td>
                      <td className="px-2 py-2">
                        <PolicyCell row={row} compact />
                      </td>
                      <td className="px-2 py-2">{clean(row.insurance_type)}</td>
                      <td className="px-2 py-2">
                        <InsurerBadge name={row.insurer_name} />
                      </td>
                      <td className="px-2 py-2">
                        <TermDateCell row={row} />
                      </td>
                      <td className="px-2 py-2 text-right">{money(row.gross_premium)}</td>
                      <td className="px-2 py-2 text-right">{percent(row.calculation_percent)}</td>
                      <td className="px-2 py-2 text-right font-semibold">
                        {money(row.unpaid_amount || row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
              <p className="text-lg font-semibold text-slate-950">
                Total: {money(total)}
              </p>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function ConfirmButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? "Saving..." : "Confirm Paid"}
    </button>
  );
}
