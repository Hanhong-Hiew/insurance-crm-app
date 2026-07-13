import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CrmMainPanel } from "@/components/crm-main-panel";
import { createClient } from "@/lib/supabase/server";

export default function ProtectedPage() {
  return (
    <Suspense fallback={<ProtectedLoading />}>
      <ProtectedContent />
    </Suspense>
  );
}

function ProtectedLoading() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 text-zinc-950">
      <div className="mx-auto max-w-7xl rounded-md border border-zinc-200 bg-white p-4">
        Loading CRM...
      </div>
    </main>
  );
}

async function ProtectedContent() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData?.claims) {
    redirect("/auth/login");
  }

  const [summaryResult, policiesResult, renewalsResult, premiumResult, commissionResult] =
    await Promise.all([
      supabase.from("dashboard_summary_view").select("*").maybeSingle(),
      supabase
        .from("main_policy_view")
        .select("*")
        .order("expiry_date", { ascending: true })
        .limit(80),
      supabase.from("renewals_due_view").select("*").limit(40),
      supabase.from("unpaid_premium_view").select("*").limit(40),
      supabase.from("unpaid_commission_view").select("*").limit(40),
    ]);

  const errors = [
    summaryResult.error?.message,
    policiesResult.error?.message,
    renewalsResult.error?.message,
    premiumResult.error?.message,
    commissionResult.error?.message,
  ].filter((message): message is string => Boolean(message));

  return (
    <CrmMainPanel
      errors={errors}
      policies={policiesResult.data ?? []}
      renewals={renewalsResult.data ?? []}
      summary={summaryResult.data ?? null}
      unpaidCommission={commissionResult.data ?? []}
      unpaidPremium={premiumResult.data ?? []}
    />
  );
}
