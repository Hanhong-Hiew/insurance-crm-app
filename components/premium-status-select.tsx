"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

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
  const [selectedStatus, setSelectedStatus] = useState<PremiumStatus>(currentStatus);
  const [hasError, setHasError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setSelectedStatus(currentStatus);
  }, [currentStatus]);

  function updateStatus(nextStatus: PremiumStatus) {
    setSelectedStatus(nextStatus);
    setHasError(false);

    const formData = new FormData();
    formData.set("policy_term_id", policyTermId);
    formData.set("premium_status", nextStatus);

    startTransition(async () => {
      try {
        await setPremiumStatus(formData);
        router.refresh();
      } catch {
        setSelectedStatus(currentStatus);
        setHasError(true);
      }
    });
  }

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      title={hasError ? "Premium status could not be updated." : undefined}
    >
      <select
        aria-label="Premium payment status"
        className={`h-8 min-w-28 rounded-full border px-2 text-xs font-semibold outline-none transition focus:ring-2 focus:ring-sky-100 disabled:cursor-wait disabled:opacity-70 ${statusClass(
          selectedStatus,
        )}`}
        disabled={isPending}
        onChange={(event) => updateStatus(event.target.value as PremiumStatus)}
        value={selectedStatus}
      >
        <option value="unpaid">Unpaid</option>
        <option value="partial">Partial</option>
        <option value="paid">Paid</option>
      </select>
      {hasError ? (
        <span className="ml-2 text-xs font-semibold text-red-700">Failed</span>
      ) : null}
    </div>
  );
}
