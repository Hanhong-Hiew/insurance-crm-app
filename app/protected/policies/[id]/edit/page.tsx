import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { PolicyEditForm } from "@/components/policy-edit-form";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function EditPolicyPage({ params }: PageProps) {
  return (
    <Suspense fallback={<PageShell policyTermId="">Loading edit form...</PageShell>}>
      <EditPolicyContent params={params} />
    </Suspense>
  );
}

async function EditPolicyContent({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData?.claims) {
    redirect("/auth/login");
  }

  const [
    termResult,
    clientAddressesResult,
    insurersResult,
    splitsResult,
    ratesResult,
    rulesResult,
    motorResult,
    fireResult,
    marineResult,
    travelResult,
    genericResult,
  ] = await Promise.all([
    supabase
      .from("policy_terms")
      .select("*, insurance_types(code, name), clients(id, client_name, business_registration_no, client_type, referral, phone, email, address)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("client_addresses")
      .select("id, client_id, address_label, address, is_default")
      .order("is_default", { ascending: false })
      .order("address_label", { ascending: true })
      .limit(500),
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
    supabase
      .from("motor_policy_details")
      .select("*, vehicles(*)")
      .eq("policy_term_id", id)
      .maybeSingle(),
    supabase.from("fire_policy_details").select("*").eq("policy_term_id", id).maybeSingle(),
    supabase.from("marine_policy_details").select("*").eq("policy_term_id", id).maybeSingle(),
    supabase.from("travel_policy_details").select("*").eq("policy_term_id", id).maybeSingle(),
    supabase.from("generic_policy_details").select("*").eq("policy_term_id", id).maybeSingle(),
  ]);

  if (termResult.error) throw termResult.error;
  if (!termResult.data) notFound();
  const setupErrors = [
    clientAddressesResult.error,
    insurersResult.error,
    splitsResult.error,
    ratesResult.error,
    rulesResult.error,
    motorResult.error,
    fireResult.error,
    marineResult.error,
    travelResult.error,
    genericResult.error,
  ].filter(Boolean);
  if (setupErrors.length) throw setupErrors[0];

  const term = termResult.data;
  const insuranceType = Array.isArray(term.insurance_types)
    ? term.insurance_types[0]
    : term.insurance_types;
  const client = Array.isArray(term.clients) ? term.clients[0] : term.clients;
  const isEquipmentPolicy =
    insuranceType?.code === "equipment_insurance" ||
    insuranceType?.code === "equipment_all_risk";
  const seriesResult = term.policy_series_id
    ? await supabase
        .from("policy_series")
        .select("primary_risk_label")
        .eq("id", term.policy_series_id)
        .maybeSingle()
    : null;
  if (seriesResult?.error) throw seriesResult.error;
  const equipmentDetail = isEquipmentPolicy ? genericResult.data ?? null : null;
  const equipmentJson =
    equipmentDetail?.details_json && typeof equipmentDetail.details_json === "object"
      ? (equipmentDetail.details_json as Record<string, unknown>)
      : {};

  return (
    <PageShell policyTermId={id}>
      <PolicyEditForm
        client={client ?? null}
        clientAddresses={clientAddressesResult.data ?? []}
        commissionRates={ratesResult.data ?? []}
        equipmentDetail={equipmentDetail}
        equipmentJson={equipmentJson}
        fireDetail={fireResult.data ?? null}
        genericDetail={genericResult.data ?? null}
        insurers={insurersResult.data ?? []}
        insuranceCode={insuranceType?.code ?? null}
        isEquipmentPolicy={isEquipmentPolicy}
        marineDetail={marineResult.data ?? null}
        motorDetail={motorResult.data ?? null}
        policyTermId={id}
        primaryRiskLabel={seriesResult?.data?.primary_risk_label ?? null}
        splitPatterns={splitsResult.data ?? []}
        splitRules={(rulesResult.data ?? []).map((rule) => {
          const payees = rule.commission_payees as
            | { name?: string | null }
            | Array<{ name?: string | null }>
            | null;
          return {
            ...rule,
            payee_name: Array.isArray(payees)
              ? payees[0]?.name ?? null
              : payees?.name ?? null,
          };
        })}
        term={term}
        travelDetail={travelResult.data ?? null}
      />
    </PageShell>
  );
}

function PageShell({
  children,
  policyTermId,
}: {
  children: React.ReactNode;
  policyTermId: string;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-950">
      <header className="border-b border-sky-100 bg-white/85 backdrop-blur">
        <div className="mx-auto max-w-[1800px] px-4 py-4">
          <Link
            className="inline-flex items-center gap-2 text-sm font-medium text-sky-700"
            href={policyTermId ? `/protected/policies/${policyTermId}` : "/protected"}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-[1800px] px-4 py-5">{children}</div>
    </main>
  );
}
