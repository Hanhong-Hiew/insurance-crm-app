import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppMenu } from "@/components/app-menu";
import { NewPolicyForm, type DuplicatePolicySource } from "@/components/new-policy-form";
import { CRM_LIST_LIMIT } from "@/lib/query-limits";
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

type ClientAddressRow = {
  id: string;
  address: string | null;
  address_label: string | null;
  client_id: string | null;
  is_default: boolean | null;
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
    | "gross_commission_share"
    | "net_commission_share"
    | "fixed_percent_of_gross"
    | "remaining_net_after_fixed_percent"
    | "equal_net_share";
  share_percent: number | string | null;
  split_pattern_id: string;
  subtract_percent: number | string | null;
  commission_payees: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type PageProps = {
  searchParams?: Promise<{ duplicate?: string }>;
};

type JsonRecord = Record<string, unknown>;

export default function NewPolicyPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<PageShell>Loading...</PageShell>}>
      <NewPolicyContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewPolicyContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const duplicateId = params?.duplicate;
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData?.claims) {
    redirect("/auth/login");
  }

  const [
    clientsResult,
    clientAddressesResult,
    typesResult,
    insurersResult,
    splitsResult,
    ratesResult,
    rulesResult,
  ] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, client_name, business_registration_no, client_type, referral, phone, email, address")
        .order("client_name", { ascending: true })
        .limit(CRM_LIST_LIMIT),
      supabase
        .from("client_addresses")
        .select("id, client_id, address_label, address, is_default")
        .order("is_default", { ascending: false })
        .order("address_label", { ascending: true })
        .limit(CRM_LIST_LIMIT),
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

  const duplicateSource = duplicateId
    ? await getDuplicatePolicySource(supabase, duplicateId)
    : null;
  const duplicateWarning =
    duplicateId && !duplicateSource
      ? "The selected record could not be duplicated. Check that the record still exists and try again."
      : null;

  const clients = (clientsResult.data ?? []) as OptionRow[];
  const clientAddresses = (clientAddressesResult.data ?? []) as ClientAddressRow[];
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
    clientAddressesResult.error?.message,
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
      {duplicateWarning ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {duplicateWarning}
        </div>
      ) : null}

      <NewPolicyForm
        clients={clients}
        clientAddresses={clientAddresses}
        commissionRates={commissionRates}
        duplicateSource={duplicateSource}
        insuranceTypes={insuranceTypes}
        insurers={insurers}
        splitRules={splitRules}
        splitPatterns={splitPatterns}
      />
    </PageShell>
  );
}

async function getDuplicatePolicySource(
  supabase: Awaited<ReturnType<typeof createClient>>,
  policyTermId: string,
): Promise<DuplicatePolicySource | null> {
  const termResult = await supabase
    .from("policy_terms")
    .select("*")
    .eq("id", policyTermId)
    .maybeSingle();

  if (termResult.error || !termResult.data) return null;

  const term = termResult.data as JsonRecord;
  const [
    clientResult,
    clientAddressResult,
    insuranceTypeResult,
    policySeriesResult,
  ] = await Promise.all([
    term.client_id
      ? supabase
          .from("clients")
          .select("id, client_name, business_registration_no, client_type, referral, phone, email, address")
          .eq("id", String(term.client_id))
          .maybeSingle()
      : null,
    term.client_address_id
      ? supabase
          .from("client_addresses")
          .select("id, client_id, address_label, address, is_default")
          .eq("id", String(term.client_address_id))
          .maybeSingle()
      : null,
    term.insurance_type_id
      ? supabase
          .from("insurance_types")
          .select("id, code, name")
          .eq("id", String(term.insurance_type_id))
          .maybeSingle()
      : null,
    term.policy_series_id
      ? supabase
          .from("policy_series")
          .select("id, primary_risk_label")
          .eq("id", String(term.policy_series_id))
          .maybeSingle()
      : null,
  ]);
  const client = (clientResult?.data ?? null) as JsonRecord | null;
  const clientAddress = (clientAddressResult?.data ?? null) as JsonRecord | null;
  const insuranceType = (insuranceTypeResult?.data ?? null) as JsonRecord | null;
  const policySeries = (policySeriesResult?.data ?? null) as JsonRecord | null;
  const code = String(insuranceType?.code ?? "").trim().toLowerCase();

  const source: DuplicatePolicySource = {
    business_registration_no: textFrom(client?.business_registration_no),
    client_address: textFrom(clientAddress?.address) || textFrom(client?.address),
    client_address_id: textFrom(clientAddress?.id) || textFrom(term.client_address_id),
    client_address_label: textFrom(clientAddress?.address_label),
    client_email: textFrom(client?.email),
    client_id: textFrom(client?.id),
    client_name: textFrom(client?.client_name),
    client_phone: textFrom(client?.phone),
    client_referral: textFrom(client?.referral),
    client_type: textFrom(client?.client_type) || "individual",
    effective_date: toDisplayDate(textFrom(term.effective_date)),
    expiry_date: toDisplayDate(textFrom(term.expiry_date)),
    gross_premium: numberLike(term.gross_premium),
    insurance_type_id: textFrom(term.insurance_type_id),
    insurer_id: textFrom(term.insurer_id),
    net_premium: numberLike(term.net_premium),
    primary_risk_label: textFrom(policySeries?.primary_risk_label),
    primary_sum_assured: numberLike(term.primary_sum_assured),
    split_pattern_id: textFrom(term.split_pattern_id),
    term_stage: textFrom(term.term_stage) || "policy",
  };

  if (code === "motor") {
    const { data } = await supabase
      .from("motor_policy_details")
      .select("*, vehicles(*)")
      .eq("policy_term_id", policyTermId)
      .maybeSingle();
    const detail = (data ?? {}) as JsonRecord;
    const vehicle = firstRelation(detail.vehicles) as JsonRecord | null;
    source.motor = {
      bdm: numberLike(detail.bdm),
      btm: numberLike(detail.btm),
      chassis_no: textFrom(vehicle?.chassis_no),
      engine_cc: numberLike(vehicle?.engine_cc),
      engine_no: textFrom(vehicle?.engine_no),
      extra_coverage: textFrom(detail.extra_coverage),
      make_model: textFrom(vehicle?.make_model),
      motor_description: textFrom(detail.motor_description),
      motor_type: textFrom(detail.motor_type),
      ncd: numberLike(detail.ncd),
      type_of_cover: textFrom(detail.type_of_cover) || "Comprehensive",
      vehicle_no: textFrom(detail.vehicle_no_snapshot) || textFrom(vehicle?.vehicle_no),
      year_of_manufacture: numberLike(vehicle?.year_of_manufacture),
    };
  } else if (code === "fire" || code === "home_insurance" || code === "industrial_all_risk") {
    const { data } = await supabase
      .from("fire_policy_details")
      .select("*")
      .eq("policy_term_id", policyTermId)
      .maybeSingle();
    const detail = (data ?? {}) as JsonRecord;
    source.fire = {
      construction_type: textFrom(detail.construction_type),
      occupation: textFrom(detail.occupation),
      property_address: textFrom(detail.property_address) || textFrom(detail.risk_location),
    };
  } else if (code === "marine_insurance") {
    const { data } = await supabase
      .from("marine_policy_details")
      .select("*")
      .eq("policy_term_id", policyTermId)
      .maybeSingle();
    const detail = (data ?? {}) as JsonRecord;
    source.marine = {
      goods_description: textFrom(detail.goods_description),
      marine_type: textFrom(detail.marine_type),
      voyage_from: textFrom(detail.voyage_from),
      voyage_to: textFrom(detail.voyage_to),
    };
  } else if (code === "travel") {
    const { data } = await supabase
      .from("travel_policy_details")
      .select("*")
      .eq("policy_term_id", policyTermId)
      .maybeSingle();
    const detail = (data ?? {}) as JsonRecord;
    source.travel = {
      destination: textFrom(detail.destination),
      pax: numberLike(detail.pax),
      plan_name: textFrom(detail.plan_name),
    };
  } else {
    const { data } = await supabase
      .from("generic_policy_details")
      .select("*")
      .eq("policy_term_id", policyTermId)
      .maybeSingle();
    const detail = (data ?? {}) as JsonRecord;
    const detailsJson =
      detail.details_json && typeof detail.details_json === "object"
        ? (detail.details_json as JsonRecord)
        : {};

    if (code === "equipment_insurance" || code === "equipment_all_risk") {
      source.equipment = {
        chassis_no: textFrom(detailsJson.chassis_no),
        description: textFrom(detail.description),
        engine_no: textFrom(detailsJson.engine_no),
        make_model: textFrom(detailsJson.make_model),
        vehicle_no: textFrom(detailsJson.vehicle_no),
        year: numberLike(detailsJson.year),
      };
    } else {
      source.generic = {
        description: textFrom(detail.description),
        detail_type: textFrom(detail.detail_type),
      };
    }
  }

  return source;
}

function firstRelation(value: unknown) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function textFrom(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function numberLike(value: unknown) {
  if (typeof value === "number" || typeof value === "string") return value;
  return null;
}

function toDisplayDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
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
            <div className="flex flex-col gap-1">
              <p className="crm-kicker">Policy intake</p>
              <h1 className="flex items-center gap-2 text-2xl font-bold">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                  <FileText className="h-5 w-5" />
                </span>
                New Policy Entry
              </h1>
              <p className="crm-page-subtitle">
                One clean entry screen for client, policy term, premium, and risk details.
              </p>
            </div>
          </div>
          <AppMenu activeHref="/protected/new-policy" path={["Dashboard", "New Policy"]} />
        </div>
      </header>
      <div className="crm-container">{children}</div>
    </main>
  );
}
