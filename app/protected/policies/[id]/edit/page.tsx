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

  const [termResult, insurersResult, splitsResult] = await Promise.all([
    supabase
      .from("policy_terms")
      .select("*, insurance_types(code, name)")
      .eq("id", id)
      .maybeSingle(),
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
  ]);

  if (termResult.error) throw termResult.error;
  if (!termResult.data) notFound();

  const term = termResult.data;
  const insuranceType = Array.isArray(term.insurance_types)
    ? term.insurance_types[0]
    : term.insurance_types;
  const isEquipmentPolicy =
    insuranceType?.code === "equipment_insurance" ||
    insuranceType?.code === "equipment_all_risk";
  const equipmentResult = isEquipmentPolicy
    ? await supabase
        .from("generic_policy_details")
        .select("description, sum_insured, details_json")
        .eq("policy_term_id", id)
        .maybeSingle()
    : null;
  const equipmentDetail = equipmentResult?.data ?? null;
  const equipmentJson =
    equipmentDetail?.details_json && typeof equipmentDetail.details_json === "object"
      ? (equipmentDetail.details_json as Record<string, unknown>)
      : {};

  return (
    <PageShell policyTermId={id}>
      <PolicyEditForm
        equipmentDetail={equipmentDetail}
        equipmentJson={equipmentJson}
        insurers={insurersResult.data ?? []}
        isEquipmentPolicy={isEquipmentPolicy}
        policyTermId={id}
        splitPatterns={splitsResult.data ?? []}
        term={term}
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
        <div className="mx-auto max-w-7xl px-4 py-4">
          <Link
            className="inline-flex items-center gap-2 text-sm font-medium text-sky-700"
            href={policyTermId ? `/protected/policies/${policyTermId}` : "/protected"}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-5">{children}</div>
    </main>
  );
}
