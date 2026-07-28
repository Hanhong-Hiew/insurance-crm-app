import { redirect } from "next/navigation";
import { Suspense } from "react";

import {
  DesignPreviewPanel,
  type DesignPreviewCommission,
  type DesignPreviewPolicy,
  type DesignPreviewSummary,
} from "@/components/design-preview-panel";
import { createClient } from "@/lib/supabase/server";

type SplitPatternLookupRow = {
  id: string;
  commission_split_patterns?:
    | { code?: string | null; name?: string | null }
    | Array<{ code?: string | null; name?: string | null }>
    | null;
};

function firstValue<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function DesignPreviewPage() {
  return (
    <Suspense fallback={<PreviewLoading />}>
      <DesignPreviewContent />
    </Suspense>
  );
}

function PreviewLoading() {
  return (
    <main className="min-h-screen bg-[#f4f7f2] px-4 py-6 text-[#18211f]">
      <div className="mx-auto max-w-[1800px] rounded-xl border border-[#d8e1d6] bg-white p-4">
        Loading design preview...
      </div>
    </main>
  );
}

async function DesignPreviewContent() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData?.claims) {
    redirect("/auth/login");
  }

  const [summaryResult, policiesResult, commissionsResult, splitPatternsResult] =
    await Promise.all([
      supabase.from("dashboard_summary_view").select("*").maybeSingle(),
      supabase
        .from("main_policy_view")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("commissions")
        .select("id, policy_term_id, amount, unpaid_amount, status")
        .limit(5000),
      supabase
        .from("policy_terms")
        .select("id, split_pattern_id, commission_split_patterns(code, name)")
        .limit(5000),
    ]);

  const errors = [
    summaryResult.error?.message,
    policiesResult.error?.message,
    commissionsResult.error?.message,
    splitPatternsResult.error?.message,
  ].filter((message): message is string => Boolean(message));
  const splitLookup = new Map(
    ((splitPatternsResult.data ?? []) as SplitPatternLookupRow[]).map((row) => {
      const pattern = firstValue(row.commission_split_patterns);
      return [
        row.id,
        {
          split_pattern_code: pattern?.code ?? null,
          split_pattern_name: pattern?.name ?? null,
        },
      ];
    }),
  );
  const policies = ((policiesResult.data ?? []) as DesignPreviewPolicy[]).map(
    (policy) => ({
      ...policy,
      ...(splitLookup.get(policy.policy_term_id) ?? {}),
    }),
  );

  return (
    <DesignPreviewPanel
      commissions={(commissionsResult.data ?? []) as DesignPreviewCommission[]}
      errors={errors}
      policies={policies}
      summary={(summaryResult.data ?? null) as DesignPreviewSummary | null}
    />
  );
}
