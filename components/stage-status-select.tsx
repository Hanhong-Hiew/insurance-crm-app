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
  policyTermId,
  stage,
}: {
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
    if (nextStage === selectedStage || isPending) return;

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

  const nextStage = selectedStage === "policy" ? "quotation" : "policy";
  const label = selectedStage === "policy" ? "P" : "Q";
  const fullLabel = selectedStage === "policy" ? "Policy issued" : "Quotation only";

  return (
    <div
      className="min-w-0"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      title={hasError ? "Stage could not be updated." : fullLabel}
    >
      <button
        aria-label={`Current stage: ${fullLabel}. Click to change stage.`}
        className={`inline-flex h-8 w-full min-w-0 items-center justify-center rounded-full border px-2 text-xs font-bold outline-none transition hover:brightness-95 focus:ring-2 focus:ring-sky-100 disabled:cursor-wait ${
          isPending ? "animate-pulse ring-2 ring-sky-100" : ""
        } ${stageClass(
          selectedStage,
        )}`}
        disabled={isPending}
        onClick={() => updateStage(nextStage)}
        type="button"
      >
        {label}
      </button>
      {hasError ? (
        <span className="ml-2 text-xs font-semibold text-red-700">Failed</span>
      ) : null}
    </div>
  );
}
