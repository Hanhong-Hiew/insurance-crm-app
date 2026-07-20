"use client";

import { Download, Eye, Search } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  confirmCommissionPayment,
  type CommissionPaymentState,
} from "@/app/protected/commission-payments/actions";
import { ActionMessage } from "@/components/action-message";

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
};

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
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function clean(value: string | null | undefined) {
  return value || "-";
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(row.commission_id)),
    [rows, selectedIds],
  );
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.client_name,
        row.insurer_name,
        row.policy_number,
        row.insurance_type,
        row.payee_name,
      ].some((value) => String(value ?? "").toLowerCase().includes(q)),
    );
  }, [query, rows]);
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

  function printStatements() {
    window.print();
  }

  return (
    <form action={formAction} className="space-y-4">
      <ActionMessage message={state.error} tone="error" />
      <ActionMessage message={state.success} tone="success" />

      {selectedIds.map((id) => (
        <input key={id} name="commission_id" type="hidden" value={id} />
      ))}

      <section className="rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm print:hidden">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_1fr_auto_auto] lg:items-end">
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Search
            </span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Client, insurer, policy, payee"
                value={query}
              />
            </span>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Paid Date
            </span>
            <input
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              name="paid_date"
              onChange={(event) => setPaidDate(event.target.value)}
              type="date"
              value={paidDate}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Notes
            </span>
            <input
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              name="notes"
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Payment reference or note"
              value={notes}
            />
          </label>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-white px-4 text-sm font-semibold text-sky-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!selectedRows.length}
            onClick={printStatements}
            type="button"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
          <ConfirmButton disabled={!selectedRows.length} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-sm print:hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold text-slate-950">Unpaid Commissions</h2>
            <p className="text-sm text-slate-500">
              Tick rows, check the statement preview, then confirm payment.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
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
                  <th className="px-3 py-3">Expiry</th>
                  <th className="px-3 py-3 text-right">Unpaid</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr className="border-t border-slate-100" key={row.commission_id}>
                    <td className="px-3 py-3">
                      <input
                        checked={selectedIds.includes(row.commission_id)}
                        onChange={() => toggleSelected(row.commission_id)}
                        type="checkbox"
                      />
                    </td>
                    <td className="px-3 py-3">{clean(row.payee_name)}</td>
                    <td className="px-3 py-3">{clean(row.client_name)}</td>
                    <td className="px-3 py-3">{clean(row.insurer_name)}</td>
                    <td className="px-3 py-3">{clean(row.policy_number)}</td>
                    <td className="px-3 py-3">{formatDate(row.expiry_date)}</td>
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
    <section className="space-y-4">
      {statementGroups.map((rows) => {
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
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Client</th>
                    <th className="px-2 py-2">Policy</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Insurer</th>
                    <th className="px-2 py-2">Effective</th>
                    <th className="px-2 py-2">Expiry</th>
                    <th className="px-2 py-2 text-right">Gross</th>
                    <th className="px-2 py-2 text-right">%</th>
                    <th className="px-2 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr className="border-t border-slate-100" key={row.commission_id}>
                      <td className="px-2 py-2">{clean(row.client_name)}</td>
                      <td className="px-2 py-2">{clean(row.policy_number)}</td>
                      <td className="px-2 py-2">{clean(row.insurance_type)}</td>
                      <td className="px-2 py-2">{clean(row.insurer_name)}</td>
                      <td className="px-2 py-2">{formatDate(row.effective_date)}</td>
                      <td className="px-2 py-2">{formatDate(row.expiry_date)}</td>
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
