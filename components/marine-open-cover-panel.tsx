"use client";

import {
  Anchor,
  CalendarDays,
  FilePlus2,
  ReceiptText,
  Ship,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo } from "react";
import { useFormStatus } from "react-dom";

import {
  createMarineMonthlyBill,
  registerMarineOpenCover,
  saveMarineDeclaration,
  setMarineBillingPaymentStatus,
  setMarineCommissionStatus,
  type MarineActionState,
} from "@/app/protected/marine/actions";
import { ActionMessage } from "@/components/action-message";
import { CurrencyInput } from "@/components/currency-input";

export type MarinePolicyOption = {
  client_name: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  insurer_name: string | null;
  policy_number: string | null;
  policy_term_id: string;
};

export type MarineOpenCoverRow = MarinePolicyOption & {
  open_cover_id: string;
  notes: string | null;
  status: string | null;
};

export type MarineDeclarationRow = {
  billing_month: string | null;
  billing_status: string | null;
  certificate_no: string | null;
  client_name: string | null;
  declaration_date: string | null;
  goods_description: string | null;
  gross_premium: number | string | null;
  id: string;
  open_cover_id: string;
  sum_insured: number | string | null;
  total_premium: number | string | null;
  vessel: string | null;
};

export type MarineBillingCommissionRow = {
  amount: number | string | null;
  billing_id: string;
  calculation_percent: number | string | null;
  id: string;
  paid_date: string | null;
  payee_name_snapshot: string | null;
  status: string | null;
  unpaid_amount: number | string | null;
};

export type MarineBillingRow = {
  billing_month: string | null;
  client_name: string | null;
  commission_paid_date: string | null;
  commission_status: string | null;
  commission_total: number;
  declaration_count: number;
  gross_premium_total: number | string | null;
  id: string;
  open_cover_id: string;
  paid_date: string | null;
  payment_status: string | null;
  total_premium_total: number | string | null;
};

function clean(value: string | null | undefined) {
  return value?.trim() || "-";
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-MY", {
    currency: "MYR",
    minimumFractionDigits: 2,
    style: "currency",
  }).format(toNumber(value)).replace("MYR", "RM");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB").format(parsed);
}

function formatMonth(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function percent(value: number | string | null | undefined) {
  const number = toNumber(value) * 100;
  return `${new Intl.NumberFormat("en-MY", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(number)}%`;
}

function monthInputValue(value: string | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 7);
  return value.slice(0, 7);
}

function statusClass(status: string | null | undefined, kind: "commission" | "payment") {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "paid") {
    return "border-emerald-300 bg-emerald-100 text-emerald-900";
  }
  if (normalized === "partial") {
    return "border-amber-300 bg-amber-100 text-amber-900";
  }
  return kind === "commission"
    ? "border-orange-300 bg-orange-100 text-orange-900"
    : "border-red-300 bg-red-100 text-red-900";
}

export function MarineOpenCoverPanel({
  billings,
  candidates,
  commissions,
  declarations,
  openCovers,
}: {
  billings: MarineBillingRow[];
  candidates: MarinePolicyOption[];
  commissions: MarineBillingCommissionRow[];
  declarations: MarineDeclarationRow[];
  openCovers: MarineOpenCoverRow[];
}) {
  const [registerState, registerAction] = useActionState<MarineActionState, FormData>(
    registerMarineOpenCover,
    {},
  );
  const [declarationState, declarationAction] = useActionState<
    MarineActionState,
    FormData
  >(saveMarineDeclaration, {});
  const [billingState, billingAction] = useActionState<MarineActionState, FormData>(
    createMarineMonthlyBill,
    {},
  );
  const [paymentState, paymentAction] = useActionState<MarineActionState, FormData>(
    setMarineBillingPaymentStatus,
    {},
  );
  const [commissionState, commissionAction] = useActionState<
    MarineActionState,
    FormData
  >(setMarineCommissionStatus, {});

  const commissionRowsByBilling = useMemo(() => {
    const grouped = new Map<string, MarineBillingCommissionRow[]>();
    for (const row of commissions) {
      grouped.set(row.billing_id, [...(grouped.get(row.billing_id) ?? []), row]);
    }
    return grouped;
  }, [commissions]);

  const stats = useMemo(
    () => [
      {
        icon: <Anchor className="h-4 w-4" />,
        label: "Open Covers",
        value: openCovers.length.toLocaleString("en-MY"),
      },
      {
        icon: <FilePlus2 className="h-4 w-4" />,
        label: "Unbilled Declarations",
        value: declarations
          .filter((row) => row.billing_status === "unbilled")
          .length.toLocaleString("en-MY"),
      },
      {
        icon: <ReceiptText className="h-4 w-4" />,
        label: "Unpaid Monthly Premium",
        value: money(
          billings
            .filter((row) => row.payment_status !== "paid")
            .reduce((sum, row) => sum + toNumber(row.total_premium_total), 0),
        ),
      },
      {
        icon: <WalletCards className="h-4 w-4" />,
        label: "Unpaid Marine Commission",
        value: money(
          commissions
            .filter((row) => row.status !== "paid")
            .reduce((sum, row) => sum + toNumber(row.unpaid_amount), 0),
        ),
      },
    ],
    [billings, commissions, declarations, openCovers],
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        {stats.map((stat) => (
          <div className="crm-card p-4" key={stat.label}>
            <div className="flex items-center gap-2 text-sky-700">
              {stat.icon}
              <p className="text-xs font-semibold uppercase tracking-[0.08em]">
                {stat.label}
              </p>
            </div>
            <p className="mt-2 text-xl font-bold text-slate-950">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="crm-card">
          <div className="crm-card-header">
            <h2 className="font-semibold text-slate-900">Register Open Cover</h2>
            <p className="text-xs text-slate-500">
              Link an existing marine policy as the annual master open cover.
            </p>
          </div>
          <form action={registerAction} className="grid gap-3 p-4">
            <ActionMessage
              message={registerState.error}
              messageKey={registerState.resultId}
              tone="error"
            />
            <ActionMessage
              message={registerState.success}
              messageKey={registerState.resultId}
              tone="success"
            />
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Marine Policy
              <select className="crm-control" name="policy_term_id" required>
                <option value="">Choose marine policy</option>
                {candidates.map((policy) => (
                  <option key={policy.policy_term_id} value={policy.policy_term_id}>
                    {clean(policy.client_name)} / {clean(policy.policy_number)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Notes
              <textarea
                className="crm-control min-h-20 py-2"
                name="notes"
                placeholder="Optional"
              />
            </label>
            <SubmitButton label="Register" />
          </form>
        </section>

        <section className="crm-card">
          <div className="crm-card-header">
            <h2 className="font-semibold text-slate-900">Add Declaration</h2>
            <p className="text-xs text-slate-500">
              Only date and premium are required. Certificate details stay optional.
            </p>
          </div>
          <form action={declarationAction} className="grid gap-3 p-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <ActionMessage
                message={declarationState.error}
                messageKey={declarationState.resultId}
                tone="error"
              />
              <ActionMessage
                message={declarationState.success}
                messageKey={declarationState.resultId}
                tone="success"
              />
            </div>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 md:col-span-2">
              Open Cover
              <select className="crm-control" name="open_cover_id" required>
                <option value="">Choose open cover</option>
                {openCovers.map((cover) => (
                  <option key={cover.open_cover_id} value={cover.open_cover_id}>
                    {clean(cover.client_name)} / {clean(cover.policy_number)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Date *
              <input className="crm-control" name="declaration_date" required type="date" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Certificate No
              <input className="crm-control" name="certificate_no" placeholder="Optional" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Gross Premium *
              <CurrencyInput name="gross_premium" required />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Total Premium
              <CurrencyInput name="total_premium" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Sum Insured
              <CurrencyInput name="sum_insured" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Vessel
              <input className="crm-control" name="vessel" placeholder="Optional" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 md:col-span-2">
              Goods Description
              <input className="crm-control" name="goods_description" placeholder="Optional" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 md:col-span-2">
              Notes
              <textarea className="crm-control min-h-20 py-2" name="notes" />
            </label>
            <div className="md:col-span-2">
              <SubmitButton label="Save Declaration" />
            </div>
          </form>
        </section>
      </div>

      <section className="crm-card">
        <div className="crm-card-header">
          <h2 className="font-semibold text-slate-900">Create Monthly Bill</h2>
          <p className="text-xs text-slate-500">
            Groups declarations by open cover and month, then calculates monthly commission.
          </p>
        </div>
        <form action={billingAction} className="grid gap-3 p-4 md:grid-cols-[1fr_180px_auto]">
          <div className="md:col-span-full">
            <ActionMessage
              message={billingState.error}
              messageKey={billingState.resultId}
              tone="error"
            />
            <ActionMessage
              message={billingState.success}
              messageKey={billingState.resultId}
              tone="success"
            />
          </div>
          <select className="crm-control" name="open_cover_id" required>
            <option value="">Choose open cover</option>
            {openCovers.map((cover) => (
              <option key={cover.open_cover_id} value={cover.open_cover_id}>
                {clean(cover.client_name)} / {clean(cover.policy_number)}
              </option>
            ))}
          </select>
          <input className="crm-control" name="billing_month" required type="month" />
          <SubmitButton label="Create Bill" />
        </form>
      </section>

      <section className="crm-card overflow-hidden">
        <div className="crm-card-header">
          <h2 className="font-semibold text-slate-900">Monthly Bills</h2>
          <p className="text-xs text-slate-500">
            Monthly premium and monthly commission are tracked here, not on the master policy.
          </p>
        </div>
        <div className="p-4">
          <ActionMessage
            message={paymentState.error || commissionState.error}
            messageKey={`${paymentState.resultId ?? ""}-${commissionState.resultId ?? ""}`}
            tone="error"
          />
          <ActionMessage
            message={paymentState.success || commissionState.success}
            messageKey={`${paymentState.resultId ?? ""}-${commissionState.resultId ?? ""}`}
            tone="success"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="crm-table min-w-[1160px]">
            <thead>
              <tr>
                <th>Month</th>
                <th>Client</th>
                <th>Declarations</th>
                <th>Premium</th>
                <th>Payment</th>
                <th>Commission</th>
                <th>Commission Rows</th>
              </tr>
            </thead>
            <tbody>
              {billings.length ? (
                billings.map((bill) => {
                  const billCommissions = commissionRowsByBilling.get(bill.id) ?? [];
                  return (
                    <tr key={bill.id}>
                      <td className="px-3 py-3 font-semibold text-slate-900">
                        {formatMonth(bill.billing_month)}
                      </td>
                      <td className="px-3 py-3">
                        <span className="crm-two-line max-w-56 text-sm font-semibold text-slate-900">
                          {clean(bill.client_name)}
                        </span>
                      </td>
                      <td className="px-3 py-3">{bill.declaration_count}</td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-950">
                          {money(bill.gross_premium_total)}
                        </p>
                        <p className="text-xs font-medium text-slate-500">
                          {money(bill.total_premium_total)}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <form action={paymentAction} className="grid gap-2">
                          <input name="billing_id" type="hidden" value={bill.id} />
                          <select
                            className={`h-9 rounded-full border px-2 text-xs font-semibold outline-none ${statusClass(
                              bill.payment_status,
                              "payment",
                            )}`}
                            defaultValue={bill.payment_status ?? "unpaid"}
                            name="payment_status"
                          >
                            <option value="unpaid">Unpaid</option>
                            <option value="partial">Partial</option>
                            <option value="paid">Paid</option>
                          </select>
                          <input
                            className="crm-control h-9 text-xs"
                            defaultValue={bill.paid_date ?? ""}
                            name="paid_date"
                            type="date"
                          />
                          <SubmitButton label="Save" small />
                        </form>
                      </td>
                      <td className="px-3 py-3">
                        <form action={commissionAction} className="grid gap-2">
                          <input name="billing_id" type="hidden" value={bill.id} />
                          <select
                            className={`h-9 rounded-full border px-2 text-xs font-semibold outline-none ${statusClass(
                              bill.commission_status,
                              "commission",
                            )}`}
                            defaultValue={bill.commission_status ?? "unpaid"}
                            name="commission_status"
                          >
                            <option value="unpaid">Unpaid</option>
                            <option value="paid">Paid</option>
                          </select>
                          <input
                            className="crm-control h-9 text-xs"
                            defaultValue={bill.commission_paid_date ?? ""}
                            name="commission_paid_date"
                            type="date"
                          />
                          <SubmitButton label="Save" small />
                        </form>
                      </td>
                      <td className="px-3 py-3">
                        <div className="grid gap-1 text-xs">
                          {billCommissions.length ? (
                            billCommissions.map((row) => (
                              <div
                                className="rounded-lg border border-orange-100 bg-orange-50 px-2 py-1"
                                key={row.id}
                              >
                                <p className="font-semibold text-slate-900">
                                  {clean(row.payee_name_snapshot)} / {percent(row.calculation_percent)}
                                </p>
                                <p className="text-slate-600">
                                  {money(row.amount)} / {clean(row.status)}
                                </p>
                              </div>
                            ))
                          ) : (
                            <span className="text-slate-500">No split yet</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-3 py-8 text-center text-slate-500" colSpan={7}>
                    No monthly bills yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="crm-card overflow-hidden">
          <div className="crm-card-header">
            <h2 className="font-semibold text-slate-900">Recent Declarations</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="crm-table min-w-[760px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Cert No</th>
                  <th>Premium</th>
                  <th>Status</th>
                  <th>Optional Details</th>
                </tr>
              </thead>
              <tbody>
                {declarations.length ? (
                  declarations.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-3">{formatDate(row.declaration_date)}</td>
                      <td className="px-3 py-3 font-semibold text-slate-900">
                        {clean(row.client_name)}
                      </td>
                      <td className="px-3 py-3">{clean(row.certificate_no)}</td>
                      <td className="px-3 py-3">
                        <p className="font-semibold">{money(row.gross_premium)}</p>
                        <p className="text-xs text-slate-500">{money(row.total_premium)}</p>
                      </td>
                      <td className="px-3 py-3">{clean(row.billing_status)}</td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        <p>Sum: {money(row.sum_insured)}</p>
                        <p>Vessel: {clean(row.vessel)}</p>
                        <p className="crm-two-line">Goods: {clean(row.goods_description)}</p>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-500" colSpan={6}>
                      No declarations yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="crm-card overflow-hidden">
          <div className="crm-card-header">
            <h2 className="font-semibold text-slate-900">Open Covers</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="crm-table min-w-[680px]">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Policy</th>
                  <th>Insurer</th>
                  <th>Term</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {openCovers.length ? (
                  openCovers.map((cover) => (
                    <tr key={cover.open_cover_id}>
                      <td className="px-3 py-3 font-semibold text-slate-900">
                        {clean(cover.client_name)}
                      </td>
                      <td className="px-3 py-3">{clean(cover.policy_number)}</td>
                      <td className="px-3 py-3">{clean(cover.insurer_name)}</td>
                      <td className="px-3 py-3">
                        {formatDate(cover.effective_date)} - {formatDate(cover.expiry_date)}
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          className="text-sm font-semibold text-sky-700 hover:text-sky-800"
                          href={`/protected/policies/${cover.policy_term_id}`}
                        >
                          Record
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-500" colSpan={5}>
                      Register a marine open cover first.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function SubmitButton({ label, small = false }: { label: string; small?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg bg-sky-700 font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-wait disabled:opacity-60 ${
        small ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm"
      }`}
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}
