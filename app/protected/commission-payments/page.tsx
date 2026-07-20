import { ArrowLeft, WalletCards } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import {
  CommissionPaymentsPanel,
  type CommissionPaymentRow,
} from "@/components/commission-payments-panel";
import { createClient } from "@/lib/supabase/server";

type RawCommissionRow = {
  amount: number | string | null;
  calculation_percent: number | string | null;
  commission_payees: { id?: string | null; name?: string | null } | Array<{ id?: string | null; name?: string | null }> | null;
  id: string;
  payee_id: string;
  policy_terms: {
    effective_date?: string | null;
    expiry_date?: string | null;
    gross_premium?: number | string | null;
    policy_number?: string | null;
    clients?: { client_name?: string | null } | Array<{ client_name?: string | null }> | null;
    insurance_types?: { name?: string | null } | Array<{ name?: string | null }> | null;
  } | null;
  status: string | null;
  unpaid_amount: number | string | null;
};

function firstValue<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function CommissionPaymentsPage() {
  return (
    <Suspense fallback={<PageShell>Loading commission payments...</PageShell>}>
      <CommissionPaymentsContent />
    </Suspense>
  );
}

async function CommissionPaymentsContent() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData?.claims) {
    redirect("/auth/login");
  }

  const { data, error } = await supabase
    .from("commissions")
    .select(
      "id, payee_id, calculation_percent, amount, unpaid_amount, status, commission_payees(id, name), policy_terms(policy_number, effective_date, expiry_date, gross_premium, clients(client_name), insurance_types(name))",
    )
    .neq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(1000);

  const rows = ((data ?? []) as RawCommissionRow[]).map((row): CommissionPaymentRow => {
    const payee = firstValue(row.commission_payees);
    const term = row.policy_terms;
    const client = firstValue(term?.clients);
    const insuranceType = firstValue(term?.insurance_types);

    return {
      amount: row.amount,
      calculation_percent: row.calculation_percent,
      client_name: client?.client_name ?? null,
      commission_id: row.id,
      effective_date: term?.effective_date ?? null,
      expiry_date: term?.expiry_date ?? null,
      gross_premium: term?.gross_premium ?? null,
      insurance_type: insuranceType?.name ?? null,
      payee_id: row.payee_id,
      payee_name: payee?.name ?? null,
      policy_number: term?.policy_number ?? null,
      status: row.status,
      unpaid_amount: row.unpaid_amount,
    };
  });

  return (
    <PageShell>
      {error ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error.message}
        </div>
      ) : null}
      <CommissionPaymentsPanel rows={rows} />
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-950">
      <header className="border-b border-sky-100 bg-white/85 backdrop-blur print:hidden">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <Link
            className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-sky-700"
            href="/protected"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
              <WalletCards className="h-5 w-5" />
            </span>
            Commission Payments
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Select commissions, preview payee statements, download/print, then confirm paid.
          </p>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-5 print:max-w-none print:px-0 print:py-0">
        {children}
      </div>
    </main>
  );
}
