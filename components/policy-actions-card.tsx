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

export function PolicyActionsCard({ policyTermId }: { policyTermId: string }) {
  const [deleteState, deleteAction] = useActionState<DeletePolicyState, FormData>(
    deletePolicy,
    {},
  );

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
          <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-sky-200 bg-white px-3 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50">
            <CheckCircle2 className="h-4 w-4" />
            Toggle Premium Paid
          </button>
        </form>
        <form action={markCommissionsPaid}>
          <input name="policy_term_id" type="hidden" value={policyTermId} />
          <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
            <CheckCircle2 className="h-4 w-4" />
            Toggle Commission Paid
          </button>
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
