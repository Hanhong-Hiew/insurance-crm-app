import { ArrowLeft, Ship } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppMenu } from "@/components/app-menu";
import {
  MarineOpenCoverPanel,
  type MarineBillingCommissionRow,
  type MarineBillingRow,
  type MarineDeclarationRow,
  type MarineOpenCoverRow,
} from "@/components/marine-open-cover-panel";
import { CRM_LIST_LIMIT } from "@/lib/query-limits";
import { createClient } from "@/lib/supabase/server";

type MarinePolicyViewRow = Omit<MarineOpenCoverRow, "notes" | "open_cover_id" | "status"> & {
  insurance_type?: string | null;
  insurance_type_code?: string | null;
};

type MarineOpenCoverDbRow = {
  id: string;
  notes: string | null;
  policy_term_id: string;
  status: string | null;
};

type MarineDeclarationDbRow = Omit<MarineDeclarationRow, "client_name">;

type MarineBillingDbRow = Omit<
  MarineBillingRow,
  "client_name" | "commission_total" | "declaration_count"
>;

export default function MarinePage() {
  return (
    <Suspense fallback={<PageShell>Loading marine open covers...</PageShell>}>
      <MarineContent />
    </Suspense>
  );
}

async function MarineContent() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData?.claims) {
    redirect("/auth/login");
  }

  const marinePoliciesResult = await supabase
    .from("main_policy_view")
    .select(
      "policy_term_id, client_name, policy_number, insurer_name, effective_date, expiry_date, insurance_type, insurance_type_code",
    )
    .eq("insurance_type_code", "marine_open_cover")
    .order("client_name", { ascending: true })
    .limit(CRM_LIST_LIMIT);

  const policies = (marinePoliciesResult.data ?? []) as MarinePolicyViewRow[];
  const policyTermIds = policies.map((policy) => policy.policy_term_id);
  const autoOpenCoverResult = policies.length
    ? await supabase.from("marine_open_covers").upsert(
        policies.map((policy) => ({
          policy_term_id: policy.policy_term_id,
          status: "active",
        })),
        { ignoreDuplicates: true, onConflict: "policy_term_id" },
      )
    : { error: null };

  const openCoversResult = policyTermIds.length
    ? await supabase
        .from("marine_open_covers")
        .select("id, policy_term_id, status, notes")
        .in("policy_term_id", policyTermIds)
        .order("created_at", { ascending: false })
        .limit(CRM_LIST_LIMIT)
    : { data: [], error: null };
  const openCoverIds = ((openCoversResult.data ?? []) as MarineOpenCoverDbRow[]).map(
    (cover) => cover.id,
  );

  const declarationsResult = openCoverIds.length
    ? await supabase
        .from("marine_declarations")
        .select(
          "id, open_cover_id, declaration_date, certificate_no, sum_insured, vessel, goods_description, gross_premium, total_premium, billing_month, billing_status",
        )
        .in("open_cover_id", openCoverIds)
        .order("declaration_date", { ascending: false })
        .limit(CRM_LIST_LIMIT)
    : { data: [], error: null };
  const billingsResult = openCoverIds.length
    ? await supabase
        .from("marine_monthly_billings")
        .select(
          "id, open_cover_id, billing_month, gross_premium_total, total_premium_total, payment_status, paid_date, commission_status, commission_paid_date",
        )
        .in("open_cover_id", openCoverIds)
        .order("billing_month", { ascending: false })
        .limit(CRM_LIST_LIMIT)
    : { data: [], error: null };
  const billingIds = ((billingsResult.data ?? []) as MarineBillingDbRow[]).map(
    (bill) => bill.id,
  );
  const commissionsResult = billingIds.length
    ? await supabase
        .from("marine_billing_commissions")
        .select(
          "id, billing_id, payee_name_snapshot, calculation_percent, amount, unpaid_amount, status, paid_date",
        )
        .in("billing_id", billingIds)
        .order("created_at", { ascending: false })
        .limit(CRM_LIST_LIMIT * 4)
    : { data: [], error: null };

  const errors = [
    marinePoliciesResult.error?.message,
    autoOpenCoverResult.error?.message,
    openCoversResult.error?.message,
    declarationsResult.error?.message,
    billingsResult.error?.message,
    commissionsResult.error?.message,
  ].filter((message): message is string => Boolean(message));

  const policyByTermId = new Map(
    policies.map((policy) => [policy.policy_term_id, policy]),
  );
  const openCovers = ((openCoversResult.data ?? []) as MarineOpenCoverDbRow[]).map(
    (cover): MarineOpenCoverRow => {
      const policy = policyByTermId.get(cover.policy_term_id);
      return {
        client_name: policy?.client_name ?? null,
        effective_date: policy?.effective_date ?? null,
        expiry_date: policy?.expiry_date ?? null,
        insurer_name: policy?.insurer_name ?? null,
        notes: cover.notes,
        open_cover_id: cover.id,
        policy_number: policy?.policy_number ?? null,
        policy_term_id: cover.policy_term_id,
        status: cover.status,
      };
    },
  );
  const openCoverById = new Map(openCovers.map((cover) => [cover.open_cover_id, cover]));
  const declarations = ((declarationsResult.data ?? []) as MarineDeclarationDbRow[]).map(
    (row): MarineDeclarationRow => ({
      ...row,
      client_name: openCoverById.get(row.open_cover_id)?.client_name ?? null,
    }),
  );
  const commissions = (commissionsResult.data ?? []) as MarineBillingCommissionRow[];
  const declarationsByBill = new Map<string, number>();
  for (const row of declarations) {
    if (!row.billing_month) continue;
    const key = `${row.open_cover_id}:${row.billing_month}`;
    declarationsByBill.set(key, (declarationsByBill.get(key) ?? 0) + 1);
  }
  const commissionTotalByBill = new Map<string, number>();
  for (const row of commissions) {
    commissionTotalByBill.set(
      row.billing_id,
      (commissionTotalByBill.get(row.billing_id) ?? 0) +
        Number(row.amount ?? 0),
    );
  }
  const billings = ((billingsResult.data ?? []) as MarineBillingDbRow[]).map(
    (row): MarineBillingRow => ({
      ...row,
      client_name: openCoverById.get(row.open_cover_id)?.client_name ?? null,
      commission_total: commissionTotalByBill.get(row.id) ?? 0,
      declaration_count:
        declarationsByBill.get(`${row.open_cover_id}:${row.billing_month}`) ?? 0,
    }),
  );

  return (
    <PageShell>
      {errors.length ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {errors.join(" ")}
        </div>
      ) : null}
      <MarineOpenCoverPanel
        billings={billings}
        commissions={commissions}
        declarations={declarations}
        openCovers={openCovers}
      />
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="crm-page">
      <header className="crm-header">
        <div className="crm-header-inner">
          <div>
            <Link
              className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-sky-700"
              href="/protected"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <p className="crm-kicker">Marine workspace</p>
            <h1 className="crm-page-title flex items-center gap-2">
              <Ship className="h-7 w-7 text-sky-700" />
              Marine Open Cover
            </h1>
            <p className="crm-page-subtitle">
              Track declarations, monthly premium billing, and monthly commission.
            </p>
          </div>
          <AppMenu activeHref="/protected/marine" path={["Dashboard", "Marine"]} />
        </div>
      </header>
      <div className="crm-container">{children}</div>
    </main>
  );
}
