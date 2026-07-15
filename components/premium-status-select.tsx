"use client";

import { setPremiumStatus } from "@/app/protected/policies/[id]/actions";

type PremiumStatus = "unpaid" | "partial" | "paid";

function normalizedStatus(value: string | null | undefined): PremiumStatus {
  return value === "paid" || value === "partial" ? value : "unpaid";
}

function statusClass(status: PremiumStatus) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (status === "partial") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-red-200 bg-red-50 text-red-800";
}

export function PremiumStatusSelect({
  policyTermId,
  status,
}: {
  policyTermId: string;
  status: string | null | undefined;
}) {
  const currentStatus = normalizedStatus(status);

  return (
    <form
      action={setPremiumStatus}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <input name="policy_term_id" type="hidden" value={policyTermId} />
      <select
        aria-label="Premium payment status"
        className={`h-8 min-w-28 rounded-full border px-2 text-xs font-semibold outline-none transition focus:ring-2 focus:ring-sky-100 ${statusClass(
          currentStatus,
        )}`}
        defaultValue={currentStatus}
        name="premium_status"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        <option value="unpaid">Unpaid</option>
        <option value="partial">Partial</option>
        <option value="paid">Paid</option>
      </select>
    </form>
  );
}
