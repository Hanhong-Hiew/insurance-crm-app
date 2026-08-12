"use client";

import { Download, Eye, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  confirmCommissionPayment,
  type CommissionPaymentState,
} from "@/app/protected/commission-payments/actions";
import { ActionMessage } from "@/components/action-message";
import { InsurerBadge } from "@/components/insurer-badge";
import {
  DEFAULT_PAGE_SIZE,
  PaginationControls,
} from "@/components/pagination-controls";
import {
  downloadCommissionStatementPdf,
  downloadCommissionStatementsPdf,
} from "@/lib/commission-statement-pdf";
import { formatPercent } from "@/lib/format";

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

export type PaidCommissionStatement = {
  batch_id: string;
  notes: string | null;
  paid_date: string | null;
  payee_id: string | null;
  payee_name: string | null;
  rows: CommissionPaymentRow[];
  statement_no: string | null;
  total_amount: number | string | null;
};

type DateSort = "effective_asc" | "effective_desc" | "expiry_asc" | "expiry_desc";
type PaidStatementQuickFilter = "all" | "this_month" | "last_month" | "this_year";

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
  return formatPercent(value);
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

function monthInputValue(value: string | null | undefined) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function statementPdfInput(statement: PaidCommissionStatement) {
  return {
    paidDate: statement.paid_date ?? "",
    payeeName: clean(statement.payee_name),
    rows: toStatementPdfRows(sortRowsByDate(statement.rows, "effective_asc")),
  };
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

function ClientCell({ row }: { row: CommissionPaymentRow }) {
  return (
    <span className="block max-w-[180px] whitespace-normal break-words leading-tight">
      {clean(row.client_name)}
    </span>
  );
}

function TermDateCell({ row }: { row: CommissionPaymentRow }) {
  return (
    <span className="leading-tight">
      {formatDate(row.effective_date)} - {formatDate(row.expiry_date)}
    </span>
  );
}

function StackedTermDateCell({ row }: { row: CommissionPaymentRow }) {
  return (
    <div className="grid gap-0.5 leading-tight">
      <span>{formatDate(row.effective_date)}</span>
      <span className="text-xs text-slate-500">{formatDate(row.expiry_date)}</span>
    </div>
  );
}

function GrossRateCell({ row }: { row: CommissionPaymentRow }) {
  return (
    <div className="grid gap-0.5 leading-tight">
      <span>{money(row.gross_premium)}</span>
      <span className="text-xs text-slate-500">{percent(row.calculation_percent)}</span>
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
  paidStatements,
  rows,
}: {
  paidStatements: PaidCommissionStatement[];
  rows: CommissionPaymentRow[];
}) {
  const [state, formAction] = useActionState<CommissionPaymentState, FormData>(
    confirmCommissionPayment,
    {},
  );
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tablePage, setTablePage] = useState(1);
  const [dateSort, setDateSort] = useState<DateSort>("effective_asc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [paidDate, setPaidDate] = useState(localIsoDate());
  const [paidDateText, setPaidDateText] = useState(() => isoToDisplayDate(localIsoDate()));
  const [notes, setNotes] = useState("");
  const [paidQuery, setPaidQuery] = useState("");
  const [paidQuickFilter, setPaidQuickFilter] = useState<PaidStatementQuickFilter>("this_month");
  const [paidFromDate, setPaidFromDate] = useState("");
  const [paidFromDateText, setPaidFromDateText] = useState("");
  const [paidToDate, setPaidToDate] = useState("");
  const [paidToDateText, setPaidToDateText] = useState("");
  const [selectedStatementIds, setSelectedStatementIds] = useState<string[]>([]);
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
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / DEFAULT_PAGE_SIZE));
  const currentTablePage = Math.min(tablePage, pageCount);
  const paginatedRows = useMemo(() => {
    const start = (currentTablePage - 1) * DEFAULT_PAGE_SIZE;
    return filteredRows.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [currentTablePage, filteredRows]);
  const visibleIds = useMemo(
    () => paginatedRows.map((row) => row.commission_id),
    [paginatedRows],
  );
  const selectedVisibleCount = visibleIds.filter((id) =>
    selectedIds.includes(id),
  ).length;
  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const someVisibleSelected =
    selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
  const selectAllRef = useRef<HTMLInputElement>(null);
  const statementGroups = useMemo(() => {
    const groups = new Map<string, CommissionPaymentRow[]>();
    for (const row of selectedRows) {
      groups.set(row.payee_id, [...(groups.get(row.payee_id) ?? []), row]);
    }
    return Array.from(groups.values());
  }, [selectedRows]);
  const payeeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          paidStatements
            .map((statement) => clean(statement.payee_name))
            .filter((name) => name !== "-"),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [paidStatements],
  );
  const [paidPayee, setPaidPayee] = useState("all");
  const filteredPaidStatements = useMemo(() => {
    const q = paidQuery.trim().toLowerCase();
    const today = new Date();
    const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;
    const fromTime = paidFromDate ? dateTime(paidFromDate) : Number.NEGATIVE_INFINITY;
    const toTime = paidToDate ? dateTime(paidToDate) : Number.POSITIVE_INFINITY;

    return [...paidStatements]
      .filter((statement) => {
        const paidDateValue = statement.paid_date ?? "";
        const paidMonthValue = monthInputValue(paidDateValue);
        const paidTime = dateTime(paidDateValue);
        const payeeName = clean(statement.payee_name);

        if (paidQuickFilter === "this_month" && paidMonthValue !== thisMonth) return false;
        if (paidQuickFilter === "last_month" && paidMonthValue !== lastMonth) return false;
        if (paidQuickFilter === "this_year" && !paidDateValue.startsWith(String(today.getFullYear()))) return false;
        if (paidTime < fromTime || paidTime > toTime) return false;
        if (paidPayee !== "all" && payeeName !== paidPayee) return false;
        if (
          q &&
          ![
            statement.statement_no,
            statement.payee_name,
            statement.notes,
            ...statement.rows.flatMap((row) => [
              row.client_name,
              row.policy_number,
              row.vehicle_no,
              row.insurer_name,
              row.insurance_type,
            ]),
          ].some((value) => String(value ?? "").toLowerCase().includes(q))
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dateDiff = dateTime(b.paid_date) - dateTime(a.paid_date);
        if (dateDiff) return dateDiff;
        return clean(b.statement_no).localeCompare(clean(a.statement_no));
      });
  }, [paidFromDate, paidPayee, paidQuery, paidQuickFilter, paidStatements, paidToDate]);
  const selectedPaidStatements = useMemo(
    () =>
      filteredPaidStatements.filter((statement) =>
        selectedStatementIds.includes(statement.batch_id),
      ),
    [filteredPaidStatements, selectedStatementIds],
  );
  const visibleStatementIds = filteredPaidStatements.map((statement) => statement.batch_id);
  const allVisibleStatementsSelected =
    visibleStatementIds.length > 0 &&
    visibleStatementIds.every((id) => selectedStatementIds.includes(id));

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id],
    );
  }

  function toggleVisibleRows() {
    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  function togglePaidStatement(id: string) {
    setSelectedStatementIds((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id],
    );
  }

  function toggleVisibleStatements() {
    setSelectedStatementIds((current) => {
      if (allVisibleStatementsSelected) {
        return current.filter((id) => !visibleStatementIds.includes(id));
      }
      return Array.from(new Set([...current, ...visibleStatementIds]));
    });
  }

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  useEffect(() => {
    setTablePage(1);
  }, [dateSort, query]);

  useEffect(() => {
    if (!state.success) return;
    setSelectedIds([]);
    router.refresh();
  }, [router, state.success]);

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

  function downloadPaidStatements(statements: PaidCommissionStatement[]) {
    downloadCommissionStatementsPdf(statements.map(statementPdfInput));
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

  function updatePaidFromDate(value: string) {
    setPaidFromDateText(value);
    setPaidFromDate(displayDateToIso(value));
  }

  function updatePaidToDate(value: string) {
    setPaidToDateText(value);
    setPaidToDate(displayDateToIso(value));
  }

  function normalisePaidStatementDate(
    isoValue: string,
    setText: (value: string) => void,
  ) {
    if (isoValue) setText(isoToDisplayDate(isoValue));
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
            <table className="crm-table min-w-[920px]">
              <thead>
                <tr>
                  <th className="px-3 py-3">
                    <input
                      aria-label="Select all visible commissions"
                      checked={allVisibleSelected}
                      disabled={!visibleIds.length}
                      onChange={toggleVisibleRows}
                      ref={selectAllRef}
                      title="Select all visible rows"
                      type="checkbox"
                    />
                  </th>
                  <th className="px-3 py-3">Payee</th>
                  <th className="px-3 py-3">Client</th>
                  <th className="px-3 py-3">Risk</th>
                  <th className="px-3 py-3">Insurer</th>
                  <th className="px-3 py-3">Policy</th>
                  <th className="px-3 py-3">Term</th>
                  <th className="px-3 py-3 text-right">Unpaid</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row) => (
                  <tr key={row.commission_id}>
                    <td className="px-3 py-3">
                      <input
                        checked={selectedIds.includes(row.commission_id)}
                        onChange={() => toggleSelected(row.commission_id)}
                        type="checkbox"
                      />
                    </td>
                    <td className="px-3 py-3">{clean(row.payee_name)}</td>
                    <td className="px-3 py-3">
                      <ClientCell row={row} />
                    </td>
                    <td className="px-3 py-3">{clean(row.insurance_type)}</td>
                    <td className="px-3 py-3">
                      <InsurerBadge name={row.insurer_name} />
                    </td>
                    <td className="px-3 py-3">
                      <PolicyCell row={row} />
                    </td>
                    <td className="px-3 py-3">
                      <StackedTermDateCell row={row} />
                    </td>
                    <td className="px-3 py-3 text-right font-semibold">
                      {money(row.unpaid_amount || row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            page={currentTablePage}
            total={filteredRows.length}
            onPageChange={setTablePage}
          />
        </div>

        <StatementPreview
          paidDate={paidDate}
          statementGroups={statementGroups}
        />
      </section>

      <section className="crm-card print:hidden">
        <div className="crm-card-header">
          <div>
            <h2 className="font-semibold text-slate-950">Paid Statements</h2>
            <p className="text-sm text-slate-500">
              Reprint saved commission statements by month, payee, date, or statement number.
            </p>
          </div>
        </div>
        <div className="grid gap-3 border-b border-slate-100 p-4 lg:grid-cols-[1fr_160px_150px_150px_150px_auto] lg:items-end">
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Search
            </span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="crm-control w-full pl-9"
                onChange={(event) => setPaidQuery(event.target.value)}
                placeholder="Statement, client, policy, vehicle"
                value={paidQuery}
              />
            </span>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Quick Filter
            </span>
            <select
              className="crm-control w-full"
              onChange={(event) => setPaidQuickFilter(event.target.value as PaidStatementQuickFilter)}
              value={paidQuickFilter}
            >
              <option value="this_month">This month</option>
              <option value="last_month">Last month</option>
              <option value="this_year">This year</option>
              <option value="all">Custom range/all</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              From
            </span>
            <input
              className="crm-control w-full"
              inputMode="numeric"
              onBlur={() => normalisePaidStatementDate(paidFromDate, setPaidFromDateText)}
              onChange={(event) => updatePaidFromDate(event.target.value)}
              placeholder="dd/mm/yyyy"
              type="text"
              value={paidFromDateText}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              To
            </span>
            <input
              className="crm-control w-full"
              inputMode="numeric"
              onBlur={() => normalisePaidStatementDate(paidToDate, setPaidToDateText)}
              onChange={(event) => updatePaidToDate(event.target.value)}
              placeholder="dd/mm/yyyy"
              type="text"
              value={paidToDateText}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Payee
            </span>
            <select
              className="crm-control w-full"
              onChange={(event) => setPaidPayee(event.target.value)}
              value={paidPayee}
            >
              <option value="all">All payees</option>
              {payeeOptions.map((payee) => (
                <option key={payee} value={payee}>
                  {payee}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-white px-3 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!selectedPaidStatements.length}
              onClick={() => downloadPaidStatements(selectedPaidStatements)}
              type="button"
            >
              <Download className="h-4 w-4" />
              Download selected
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="crm-table min-w-[920px]">
            <thead>
              <tr>
                <th className="px-3 py-3">
                  <input
                    aria-label="Select all visible paid statements"
                    checked={allVisibleStatementsSelected}
                    disabled={!visibleStatementIds.length}
                    onChange={toggleVisibleStatements}
                    type="checkbox"
                  />
                </th>
                <th className="px-3 py-3">Statement</th>
                <th className="px-3 py-3">Paid Date</th>
                <th className="px-3 py-3">Payee</th>
                <th className="px-3 py-3 text-right">Policies</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3">Notes</th>
                <th className="px-3 py-3 text-right">Download</th>
              </tr>
            </thead>
            <tbody>
              {filteredPaidStatements.map((statement) => (
                <tr key={statement.batch_id}>
                  <td className="px-3 py-3">
                    <input
                      checked={selectedStatementIds.includes(statement.batch_id)}
                      onChange={() => togglePaidStatement(statement.batch_id)}
                      type="checkbox"
                    />
                  </td>
                  <td className="px-3 py-3 font-semibold text-slate-950">
                    {clean(statement.statement_no)}
                  </td>
                  <td className="px-3 py-3">{formatDate(statement.paid_date)}</td>
                  <td className="px-3 py-3">{clean(statement.payee_name)}</td>
                  <td className="px-3 py-3 text-right">{statement.rows.length}</td>
                  <td className="px-3 py-3 text-right font-semibold">
                    {money(statement.total_amount)}
                  </td>
                  <td className="max-w-[220px] px-3 py-3 text-sm text-slate-500">
                    {clean(statement.notes)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-sky-200 bg-white px-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-50"
                        onClick={() => downloadCommissionStatementPdf(statementPdfInput(statement))}
                        type="button"
                      >
                        <Download className="mr-1 h-3.5 w-3.5" />
                        PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredPaidStatements.length ? (
                <tr>
                  <td className="px-3 py-6 text-center text-sm text-slate-500" colSpan={8}>
                    No paid statements match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
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
                    <th className="px-2 py-2">No.</th>
                    <th className="px-2 py-2">Client / Policy No.</th>
                    <th className="px-2 py-2">Vehicle No.</th>
                    <th className="px-2 py-2">Risk</th>
                    <th className="px-2 py-2">Insurer</th>
                    <th className="px-2 py-2">Term</th>
                    <th className="px-2 py-2">Gross / Rate</th>
                    <th className="px-2 py-2">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row, index) => (
                    <tr key={row.commission_id}>
                      <td className="px-2 py-2 text-slate-500">{index + 1}</td>
                      <td className="px-2 py-2">
                        <div className="grid gap-0.5 leading-tight">
                          <span className="font-medium text-slate-950">
                            {clean(row.client_name)}
                          </span>
                          <span className="text-xs text-slate-500">
                            {clean(row.policy_number)}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2">{clean(row.vehicle_no)}</td>
                      <td className="px-2 py-2">{clean(row.insurance_type)}</td>
                      <td className="px-2 py-2">
                        <InsurerBadge name={row.insurer_name} wrap />
                      </td>
                      <td className="px-2 py-2">
                        <TermDateCell row={row} />
                      </td>
                      <td className="px-2 py-2">
                        <GrossRateCell row={row} />
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 font-semibold">
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
