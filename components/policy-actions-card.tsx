"use client";

import { CalendarPlus, CheckCircle2, Trash2 } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  deletePolicy,
  type DeletePolicyState,
  markCommissionsPaid,
  markPremiumPaid,
  startRenewal,
} from "@/app/protected/policies/[id]/actions";
import { ActionMessage } from "@/components/action-message";

export function PolicyActionsCard({
  allCommissionsPaid,
  hasCommissions,
  policyTermId,
  premiumStatus,
}: {
  allCommissionsPaid: boolean;
  hasCommissions: boolean;
  policyTermId: string;
  premiumStatus: string | null | undefined;
}) {
  const [deleteState, deleteAction] = useActionState<DeletePolicyState, FormData>(
    deletePolicy,
    {},
  );
  const premiumPaid = premiumStatus === "paid";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-800">Actions</h2>
      <div className="mt-3 grid gap-2">
        <form action={startRenewal}>
          <input name="policy_term_id" type="hidden" value={policyTermId} />
          <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
            <CalendarPlus className="h-4 w-4" />
            Start Renewal
          </button>
        </form>
        <form action={markPremiumPaid}>
          <input name="policy_term_id" type="hidden" value={policyTermId} />
          <PaymentActionButton
            isPaid={premiumPaid}
            paidLabel="Premium Paid"
            pendingLabel="Updating premium..."
            title={premiumPaid ? "Click to mark premium unpaid" : "Mark premium paid"}
            unpaidLabel="Mark Premium Paid"
          />
        </form>
        <form action={markCommissionsPaid}>
          <input name="policy_term_id" type="hidden" value={policyTermId} />
          <PaymentActionButton
            disabled={!hasCommissions}
            isPaid={allCommissionsPaid}
            paidLabel="Commission Paid"
            pendingLabel="Updating commission..."
            title={
              hasCommissions
                ? allCommissionsPaid
                  ? "Click to mark commissions unpaid"
                  : "Mark all commissions paid"
                : "No commission rows to update"
            }
            unpaidLabel="Mark Commission Paid"
          />
        </form>
        <form action={deleteAction} className="rounded-lg border border-red-200 bg-red-50 p-3">
          <input name="policy_term_id" type="hidden" value={policyTermId} />
          <div className="mb-2">
            <ActionMessage message={deleteState.error} tone="error" />
          </div>
          <label className="grid gap-2 text-xs font-medium text-red-900">
            Type DELETE to remove wrong policy row
            <input
              className="h-9 rounded-md border border-red-200 bg-white px-3 text-sm text-red-950 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              name="delete_confirmation"
              placeholder="DELETE"
            />
          </label>
          <DeleteButton />
        </form>
      </div>
    </section>
  );
}

function PaymentActionButton({
  disabled = false,
  isPaid,
  paidLabel,
  pendingLabel,
  title,
  unpaidLabel,
}: {
  disabled?: boolean;
  isPaid: boolean;
  paidLabel: string;
  pendingLabel: string;
  title: string;
  unpaidLabel: string;
}) {
  const { pending } = useFormStatus();
  const label = pending ? pendingLabel : isPaid ? paidLabel : unpaidLabel;
  const className = isPaid
    ? "border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-700"
    : "border-sky-200 bg-white text-sky-700 hover:bg-sky-50";

  return (
    <button
      className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
        pending ? "animate-pulse ring-2 ring-sky-100" : ""
      } ${className}`}
      disabled={disabled || pending}
      title={title}
      type="submit"
    >
      <CheckCircle2 className="h-4 w-4" />
      {label}
    </button>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
      disabled={pending}
      type="submit"
    >
      <Trash2 className="h-4 w-4" />
      {pending ? "Deleting..." : "Delete Policy"}
    </button>
  );
}
