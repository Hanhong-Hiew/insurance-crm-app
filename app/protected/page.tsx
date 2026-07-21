import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CrmMainPanel } from "@/components/crm-main-panel";
import { createClient } from "@/lib/supabase/server";

type RawCommissionRow = {
  id: string;
  policy_term_id: string;
  calculation_percent: number | string | null;
  amount: number | string | null;
  unpaid_amount: number | string | null;
  status: string | null;
  paid_date: string | null;
  commission_payment_batches?: { statement_no?: string | null } | Array<{ statement_no?: string | null }> | null;
  commission_payees: { name?: string | null } | Array<{ name?: string | null }> | null;
  policy_terms: {
    policy_number?: string | null;
    effective_date?: string | null;
    expiry_date?: string | null;
    clients?: { client_name?: string | null } | Array<{ client_name?: string | null }> | null;
    insurance_types?: { name?: string | null } | Array<{ name?: string | null }> | null;
  } | null;
};

type SplitPatternLookupRow = {
  id: string;
  commission_split_patterns?: { code?: string | null; name?: string | null } | Array<{ code?: string | null; name?: string | null }> | null;
  split_pattern_id?: string | null;
};

function firstValue<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

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

  const [
    summaryResult,
    policiesResult,
    renewalsResult,
    premiumResult,
    commissionResult,
    allCommissionResult,
    splitPatternsResult,
  ] =
    await Promise.all([
      supabase.from("dashboard_summary_view").select("*").maybeSingle(),
      supabase
        .from("main_policy_view")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("renewals_due_view").select("*").limit(40),
      supabase.from("unpaid_premium_view").select("*").limit(40),
      supabase.from("unpaid_commission_view").select("*").limit(40),
      supabase
        .from("commissions")
        .select(
          "id, policy_term_id, calculation_percent, amount, unpaid_amount, status, paid_date, commission_payees(name), commission_payment_batches(statement_no), policy_terms(policy_number, effective_date, expiry_date, clients(client_name), insurance_types(name))",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("policy_terms")
        .select("id, split_pattern_id, commission_split_patterns(code, name)")
        .limit(5000),
    ]);

  const errors = [
    summaryResult.error?.message,
    policiesResult.error?.message,
    renewalsResult.error?.message,
    premiumResult.error?.message,
    commissionResult.error?.message,
    allCommissionResult.error?.message,
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
  const policies = (policiesResult.data ?? []).map((policy) => ({
    ...policy,
    ...(splitLookup.get(policy.policy_term_id) ?? {}),
  }));
  const renewals = (renewalsResult.data ?? []).map((policy) => ({
    ...policy,
    ...(splitLookup.get(policy.policy_term_id) ?? {}),
  }));
  const unpaidPremium = (premiumResult.data ?? []).map((policy) => ({
    ...policy,
    ...(splitLookup.get(policy.policy_term_id) ?? {}),
  }));
  const commissions = ((allCommissionResult.data ?? []) as RawCommissionRow[]).map(
    (commission) => {
      const term = commission.policy_terms;
      const payee = firstValue(commission.commission_payees);
      const batch = firstValue(commission.commission_payment_batches);
      const client = firstValue(term?.clients);
      const insuranceType = firstValue(term?.insurance_types);

      return {
        commission_id: commission.id,
        policy_term_id: commission.policy_term_id,
        client_name: client?.client_name ?? null,
        policy_number: term?.policy_number ?? null,
        insurance_type: insuranceType?.name ?? null,
        payee_name: payee?.name ?? null,
        calculation_percent: commission.calculation_percent,
        amount: commission.amount,
        unpaid_amount: commission.unpaid_amount,
        status: commission.status,
        effective_date: term?.effective_date ?? null,
        expiry_date: term?.expiry_date ?? null,
        paid_date: commission.paid_date,
        statement_no: batch?.statement_no ?? null,
      };
    },
  );

  return (
    <CrmMainPanel
      commissions={commissions}
      errors={errors}
      policies={policies}
      renewals={renewals}
      summary={summaryResult.data ?? null}
      unpaidCommission={commissionResult.data ?? []}
      unpaidPremium={unpaidPremium}
    />
  );
}
