import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { NewPolicyForm } from "@/components/new-policy-form";
import { createClient } from "@/lib/supabase/server";

type OptionRow = {
  id: string;
  address?: string | null;
  name?: string | null;
  client_name?: string | null;
  business_registration_no?: string | null;
  client_type?: string | null;
  referral?: string | null;
  phone?: string | null;
  email?: string | null;
  insurer_name?: string | null;
  code?: string | null;
};

type CommissionRateRow = {
  gross_commission_percent: number | string | null;
  insurance_type_id: string | null;
  net_commission_percent: number | string | null;
};

type SplitRuleRow = {
  fixed_percent: number | string | null;
  payee_id: string;
  rule_type:
    | "net_commission_share"
    | "fixed_percent_of_gross"
    | "remaining_net_after_fixed_percent"
    | "equal_net_share";
  share_percent: number | string | null;
  split_pattern_id: string;
  subtract_percent: number | string | null;
  commission_payees: { name?: string | null } | Array<{ name?: string | null }> | null;
};

export default function NewPolicyPage() {
  return (
    <Suspense fallback={<PageShell>Loading...</PageShell>}>
      <NewPolicyContent />
    </Suspense>
  );
}

async function NewPolicyContent() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData?.claims) {
    redirect("/auth/login");
  }

  const [clientsResult, typesResult, insurersResult, splitsResult, ratesResult, rulesResult] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, client_name, business_registration_no, client_type, referral, phone, email, address")
        .order("client_name", { ascending: true })
        .limit(100),
      supabase
        .from("insurance_types")
        .select("id, code, name")
        .eq("active", true)
        .order("name", { ascending: true }),
      supabase
        .from("insurers")
        .select("id, insurer_name")
        .eq("active", true)
        .order("insurer_name", { ascending: true }),
      supabase
        .from("commission_split_patterns")
        .select("id, code, name")
        .eq("active", true)
        .order("code", { ascending: true }),
      supabase
        .from("commission_rate_settings")
        .select("insurance_type_id, gross_commission_percent, net_commission_percent")
        .eq("active", true)
        .is("effective_to", null),
      supabase
        .from("commission_split_rules")
        .select("split_pattern_id, payee_id, rule_type, share_percent, fixed_percent, subtract_percent, commission_payees(name)")
        .order("sort_order", { ascending: true }),
    ]);

  const clients = (clientsResult.data ?? []) as OptionRow[];
  const insuranceTypes = (typesResult.data ?? []) as OptionRow[];
  const insurers = (insurersResult.data ?? []) as OptionRow[];
  const splitPatterns = (splitsResult.data ?? []) as OptionRow[];
  const commissionRates = (ratesResult.data ?? []) as CommissionRateRow[];
  const splitRules = ((rulesResult.data ?? []) as SplitRuleRow[]).map((rule) => ({
    ...rule,
    payee_name: Array.isArray(rule.commission_payees)
      ? rule.commission_payees[0]?.name ?? null
      : rule.commission_payees?.name ?? null,
  }));
  const errors = [
    clientsResult.error?.message,
    typesResult.error?.message,
    insurersResult.error?.message,
    splitsResult.error?.message,
    ratesResult.error?.message,
    rulesResult.error?.message,
  ].filter((message): message is string => Boolean(message));

  return (
    <PageShell>
      {errors.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {errors.join(" ")}
        </div>
      ) : null}

      <NewPolicyForm
        clients={clients}
        commissionRates={commissionRates}
        insuranceTypes={insuranceTypes}
        insurers={insurers}
        splitRules={splitRules}
        splitPatterns={splitPatterns}
      />
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-950">
      <header className="border-b border-sky-100 bg-white/85 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <Link
            className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-sky-700"
            href="/protected"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <div className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                <FileText className="h-5 w-5" />
              </span>
              New Policy Entry
            </h1>
            <p className="text-sm text-slate-500">
              One clean entry screen for client, policy term, premium, and risk details.
            </p>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-5">{children}</div>
    </main>
  );
}
