"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { setTermStage } from "@/app/protected/policies/[id]/actions";

type TermStage = "policy" | "quotation";

function normalizedStage(value: string | null | undefined): TermStage {
  return value === "quotation" ? "quotation" : "policy";
}

function stageClass(stage: TermStage) {
  if (stage === "quotation") {
    return "border-orange-300 bg-orange-100 text-orange-900";
  }
  return "border-emerald-300 bg-emerald-100 text-emerald-900";
}

export function StageStatusSelect({
  compact = false,
  policyTermId,
  stage,
}: {
  compact?: boolean;
  policyTermId: string;
  stage: string | null | undefined;
}) {
  const currentStage = normalizedStage(stage);
  const [selectedStage, setSelectedStage] = useState<TermStage>(currentStage);
  const [hasError, setHasError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setSelectedStage(currentStage);
  }, [currentStage]);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 1400);
    return () => window.clearTimeout(timer);
  }, [saved]);

  function updateStage(nextStage: TermStage) {
    setSelectedStage(nextStage);
    setHasError(false);
    setSaved(false);

    const formData = new FormData();
    formData.set("policy_term_id", policyTermId);
    formData.set("term_stage", nextStage);

    startTransition(async () => {
      try {
        await setTermStage(formData);
        setSaved(true);
        router.refresh();
      } catch {
        setSelectedStage(currentStage);
        setHasError(true);
      }
    });
  }

  return (
    <div
      className={compact ? "min-w-0" : undefined}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      title={hasError ? "Stage could not be updated." : undefined}
    >
      <select
        aria-label="Policy stage"
        className={`h-8 rounded-full border px-2 text-xs font-semibold outline-none transition focus:ring-2 focus:ring-sky-100 disabled:cursor-wait ${
          compact ? "w-full min-w-0" : "min-w-24"
        } ${isPending ? "animate-pulse ring-2 ring-sky-100" : ""} ${stageClass(
          selectedStage,
        )}`}
        disabled={isPending}
        onChange={(event) => updateStage(event.target.value as TermStage)}
        value={selectedStage}
      >
        <option value="policy">P</option>
        <option value="quotation">Q</option>
      </select>
      {hasError ? (
        <span className="ml-2 text-xs font-semibold text-red-700">Failed</span>
      ) : null}
    </div>
  );
}
