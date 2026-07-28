import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppMenu } from "@/components/app-menu";
import { RecordsPanel, type PolicyRecord } from "@/components/records-panel";
import { createClient } from "@/lib/supabase/server";

type CommissionTotalRow = {
  policy_term_id: string;
  amount: number | string | null;
  unpaid_amount?: number | string | null;
  status?: string | null;
};

type SplitPatternLookupRow = {
  id: string;
  commission_split_patterns?: { code?: string | null; name?: string | null } | Array<{ code?: string | null; name?: string | null }> | null;
};

function firstValue<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function RecordsPage() {
  return (
    <Suspense fallback={<PageShell>Loading records...</PageShell>}>
      <RecordsContent />
    </Suspense>
  );
}

async function RecordsContent() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData?.claims) {
    redirect("/auth/login");
  }

  const [recordsResult, commissionsResult, splitPatternsResult] = await Promise.all([
    supabase
      .from("main_policy_view")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("commissions")
      .select("policy_term_id, amount, unpaid_amount, status")
      .limit(5000),
    supabase
      .from("policy_terms")
      .select("id, split_pattern_id, commission_split_patterns(code, name)")
      .limit(5000),
  ]);

  const errors = [
    recordsResult.error?.message,
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
  const policies = ((recordsResult.data ?? []) as PolicyRecord[]).map((policy) => ({
    ...policy,
    ...(splitLookup.get(policy.policy_term_id) ?? {}),
  }));

  return (
    <PageShell>
      {errors.length ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {errors.join(" ")}
        </div>
      ) : null}
      <RecordsPanel
        commissionTotals={(commissionsResult.data ?? []) as CommissionTotalRow[]}
        policies={policies}
      />
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-950">
      <header className="border-b border-sky-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-sky-700"
              href="/protected"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <h1 className="text-2xl font-semibold">Records Analysis</h1>
            <p className="mt-1 text-sm text-slate-500">
              Search, filter, group, and sort policy records.
            </p>
          </div>
          <AppMenu activeHref="/protected/records" path={["Dashboard", "Records"]} />
        </div>
      </header>
      <div className="mx-auto max-w-[1800px] px-4 py-5">{children}</div>
    </main>
  );
}
