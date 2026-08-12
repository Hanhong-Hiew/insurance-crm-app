import { ArrowLeft, WalletCards } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppMenu } from "@/components/app-menu";
import {
  CommissionPaymentsPanel,
  type CommissionPaymentRow,
  type PaidCommissionStatement,
} from "@/components/commission-payments-panel";
import { CRM_LIST_LIMIT } from "@/lib/query-limits";
import { createClient } from "@/lib/supabase/server";

type RawCommissionRow = {
  amount: number | string | null;
  calculation_percent: number | string | null;
  commission_payees: { id?: string | null; name?: string | null } | Array<{ id?: string | null; name?: string | null }> | null;
  id: string;
  payee_id: string;
  policy_terms: {
    id?: string | null;
    effective_date?: string | null;
    expiry_date?: string | null;
    gross_premium?: number | string | null;
    premium_status?: string | null;
    policy_number?: string | null;
    clients?: { client_name?: string | null } | Array<{ client_name?: string | null }> | null;
    insurers?: { insurer_name?: string | null } | Array<{ insurer_name?: string | null }> | null;
    insurance_types?: { name?: string | null } | Array<{ name?: string | null }> | null;
  } | null;
  status: string | null;
  unpaid_amount: number | string | null;
};

type PolicyViewRow = {
  policy_term_id: string | null;
  vehicle_no: string | null;
};

type PaidStatementViewRow = {
  amount_payable: number | string | null;
  batch_id: string | null;
  client_name_snapshot: string | null;
  commission_id: string | null;
  commission_percent_snapshot: number | string | null;
  effective_date_snapshot: string | null;
  expiry_date_snapshot: string | null;
  gross_premium_snapshot: number | string | null;
  insurance_type_snapshot: string | null;
  insurer_name_snapshot: string | null;
  item_id: string | null;
  notes: string | null;
  paid_date: string | null;
  payee_id: string | null;
  payee_name: string | null;
  policy_number_snapshot: string | null;
  statement_no: string | null;
  statement_status: string | null;
  total_amount: number | string | null;
};

type CommissionTermLookupRow = {
  id: string;
  policy_term_id: string | null;
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

  const [unpaidResult, paidStatementResult] = await Promise.all([
    supabase
      .from("commissions")
      .select(
        "id, payee_id, calculation_percent, amount, unpaid_amount, status, commission_payees(id, name), policy_terms!inner(id, policy_number, effective_date, expiry_date, gross_premium, premium_status, clients(client_name), insurers(insurer_name), insurance_types(name))",
      )
      .neq("status", "paid")
      .eq("policy_terms.premium_status", "paid")
      .order("created_at", { ascending: false })
      .limit(CRM_LIST_LIMIT),
    supabase
      .from("commission_payment_statement_view")
      .select("*")
      .eq("statement_status", "paid")
      .order("paid_date", { ascending: false, nullsFirst: false })
      .limit(CRM_LIST_LIMIT * 5),
  ]);

  const policyTermIds = Array.from(
    new Set(
      ((unpaidResult.data ?? []) as RawCommissionRow[])
        .map((row) => row.policy_terms?.id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const paidStatementRows = (paidStatementResult.data ?? []) as PaidStatementViewRow[];
  const paidCommissionIds = Array.from(
    new Set(
      paidStatementRows
        .map((row) => row.commission_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const paidCommissionTermResult = paidCommissionIds.length
    ? await supabase
        .from("commissions")
        .select("id, policy_term_id")
        .in("id", paidCommissionIds)
    : { data: [], error: null };
  const paidPolicyTermIds = Array.from(
    new Set(
      ((paidCommissionTermResult.data ?? []) as CommissionTermLookupRow[])
        .map((row) => row.policy_term_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const paidPolicyTermByCommissionId = new Map(
    ((paidCommissionTermResult.data ?? []) as CommissionTermLookupRow[]).map((row) => [
      row.id,
      row.policy_term_id,
    ]),
  );
  const vehicleResult = policyTermIds.length
    ? await supabase
        .from("main_policy_view")
        .select("policy_term_id, vehicle_no")
        .in("policy_term_id", policyTermIds)
    : { data: [], error: null };
  const paidVehicleResult = paidPolicyTermIds.length
    ? await supabase
        .from("main_policy_view")
        .select("policy_term_id, vehicle_no")
        .in("policy_term_id", paidPolicyTermIds)
    : { data: [], error: null };
  const vehicleByTermId = new Map(
    ((vehicleResult.data ?? []) as PolicyViewRow[]).map((row) => [
      row.policy_term_id,
      row.vehicle_no,
    ]),
  );
  const paidVehicleByTermId = new Map(
    ((paidVehicleResult.data ?? []) as PolicyViewRow[]).map((row) => [
      row.policy_term_id,
      row.vehicle_no,
    ]),
  );

  const rows = ((unpaidResult.data ?? []) as RawCommissionRow[]).map((row): CommissionPaymentRow => {
    const payee = firstValue(row.commission_payees);
    const term = row.policy_terms;
    const client = firstValue(term?.clients);
    const insurer = firstValue(term?.insurers);
    const insuranceType = firstValue(term?.insurance_types);

    return {
      amount: row.amount,
      calculation_percent: row.calculation_percent,
      client_name: client?.client_name ?? null,
      commission_id: row.id,
      effective_date: term?.effective_date ?? null,
      expiry_date: term?.expiry_date ?? null,
      gross_premium: term?.gross_premium ?? null,
      insurer_name: insurer?.insurer_name ?? null,
      insurance_type: insuranceType?.name ?? null,
      payee_id: row.payee_id,
      payee_name: payee?.name ?? null,
      policy_number: term?.policy_number ?? null,
      status: row.status,
      unpaid_amount: row.unpaid_amount,
      vehicle_no: term?.id ? vehicleByTermId.get(term.id) ?? null : null,
    };
  });
  const paidStatementMap = new Map<string, PaidCommissionStatement>();
  for (const row of paidStatementRows) {
    if (!row.batch_id) continue;
    const statement = paidStatementMap.get(row.batch_id) ?? {
      batch_id: row.batch_id,
      notes: row.notes,
      paid_date: row.paid_date,
      payee_id: row.payee_id,
      payee_name: row.payee_name,
      rows: [],
      statement_no: row.statement_no,
      total_amount: row.total_amount,
    };

    if (row.commission_id || row.item_id) {
      const policyTermId = row.commission_id
        ? paidPolicyTermByCommissionId.get(row.commission_id) ?? null
        : null;
      statement.rows.push({
        amount: row.amount_payable,
        calculation_percent: row.commission_percent_snapshot,
        client_name: row.client_name_snapshot,
        commission_id: row.commission_id ?? row.item_id ?? `${row.batch_id}-${statement.rows.length}`,
        effective_date: row.effective_date_snapshot,
        expiry_date: row.expiry_date_snapshot,
        gross_premium: row.gross_premium_snapshot,
        insurer_name: row.insurer_name_snapshot,
        insurance_type: row.insurance_type_snapshot,
        payee_id: row.payee_id ?? row.batch_id,
        payee_name: row.payee_name,
        policy_number: row.policy_number_snapshot,
        status: row.statement_status,
        unpaid_amount: row.amount_payable,
        vehicle_no: policyTermId ? paidVehicleByTermId.get(policyTermId) ?? null : null,
      });
    }
    paidStatementMap.set(row.batch_id, statement);
  }
  const paidStatements = Array.from(paidStatementMap.values());

  return (
    <PageShell>
      {unpaidResult.error || paidStatementResult.error || vehicleResult.error || paidCommissionTermResult.error || paidVehicleResult.error ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {[
            unpaidResult.error?.message,
            paidStatementResult.error?.message,
            vehicleResult.error?.message,
            paidCommissionTermResult.error?.message,
            paidVehicleResult.error?.message,
          ].filter(Boolean).join(" ")}
        </div>
      ) : null}
      <CommissionPaymentsPanel paidStatements={paidStatements} rows={rows} />
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="crm-page">
      <header className="crm-header print:hidden">
        <div className="crm-header-inner">
          <div>
            <Link
              className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-sky-700"
              href="/protected"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <p className="crm-kicker">Payee workflow</p>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
                <WalletCards className="h-5 w-5" />
              </span>
              Commission
            </h1>
            <p className="crm-page-subtitle">
              Select commissions, preview payee statements, download/print, then confirm paid.
            </p>
          </div>
          <AppMenu
            activeHref="/protected/commission-payments"
            path={["Dashboard", "Commission"]}
          />
        </div>
      </header>
      <div className="crm-container print:max-w-none print:px-0 print:py-0">
        {children}
      </div>
    </main>
  );
}
