"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type DeletePolicyState = {
  error?: string;
};

async function requireUser() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();
  if (userError || !userData?.claims) {
    throw new Error("You must be logged in.");
  }
  return { supabase, userId: String(userData.claims.sub) };
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function addOneYear(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  recordId: string,
  action: string,
  message: string,
) {
  await supabase.from("activity_logs").insert({
    record_type: "policy_term",
    record_id: recordId,
    action,
    message,
    created_by: userId,
  });
}

export async function markPremiumPaid(formData: FormData) {
  const policyTermId = textValue(formData, "policy_term_id");
  const { supabase, userId } = await requireUser();

  const { data: policyTerm, error: lookupError } = await supabase
    .from("policy_terms")
    .select("premium_status")
    .eq("id", policyTermId)
    .single();
  if (lookupError) throw lookupError;

  const nextStatus = policyTerm.premium_status === "paid" ? "unpaid" : "paid";
  const { error } = await supabase
    .from("policy_terms")
    .update({ premium_status: nextStatus })
    .eq("id", policyTermId);
  if (error) throw error;

  await logActivity(
    supabase,
    userId,
    policyTermId,
    "premium_status_toggle",
    `Marked premium as ${nextStatus}.`,
  );
  revalidatePath("/protected");
  revalidatePath("/protected/records");
  revalidatePath(`/protected/policies/${policyTermId}`);
}

export async function setPremiumStatus(formData: FormData) {
  const policyTermId = textValue(formData, "policy_term_id");
  const premiumStatus = textValue(formData, "premium_status");
  const { supabase, userId } = await requireUser();

  if (!["unpaid", "partial", "paid"].includes(premiumStatus)) {
    throw new Error("Premium status must be unpaid, partial, or paid.");
  }

  const { error } = await supabase
    .from("policy_terms")
    .update({ premium_status: premiumStatus })
    .eq("id", policyTermId);
  if (error) throw error;

  await logActivity(
    supabase,
    userId,
    policyTermId,
    "premium_status_update",
    `Set premium status to ${premiumStatus}.`,
  );
  revalidatePath("/protected");
  revalidatePath("/protected/records");
  revalidatePath(`/protected/policies/${policyTermId}`);
}

export async function markCommissionsPaid(formData: FormData) {
  const policyTermId = textValue(formData, "policy_term_id");
  const { supabase, userId } = await requireUser();

  const { data: commissionRows, error: lookupError } = await supabase
    .from("commissions")
    .select("id, amount, status")
    .eq("policy_term_id", policyTermId);
  if (lookupError) throw lookupError;

  const allPaid =
    (commissionRows ?? []).length > 0 &&
    (commissionRows ?? []).every((commission) => commission.status === "paid");
  const nextStatus = allPaid ? "unpaid" : "paid";
  const paidDate = nextStatus === "paid" ? new Date().toISOString().slice(0, 10) : null;

  if (nextStatus === "paid") {
  const { error } = await supabase
    .from("commissions")
    .update({
      status: "paid",
      unpaid_amount: 0,
      paid_date: paidDate,
    })
    .eq("policy_term_id", policyTermId);
  if (error) throw error;
  } else {
    const updates = await Promise.all(
      (commissionRows ?? []).map((commission) =>
        supabase
          .from("commissions")
          .update({
            status: "unpaid",
            unpaid_amount: commission.amount,
            paid_date: null,
          })
          .eq("id", commission.id),
      ),
    );
    const updateError = updates.find((result) => result.error)?.error;
    if (updateError) throw updateError;
  }

  await logActivity(
    supabase,
    userId,
    policyTermId,
    "commission_status_toggle",
    `Marked commissions as ${nextStatus}.`,
  );
  revalidatePath("/protected");
  revalidatePath(`/protected/policies/${policyTermId}`);
}

export async function deletePolicy(
  _previousState: DeletePolicyState,
  formData: FormData,
): Promise<DeletePolicyState> {
  const policyTermId = textValue(formData, "policy_term_id");
  const confirmation = textValue(formData, "delete_confirmation");
  const { supabase, userId } = await requireUser();

  if (confirmation !== "DELETE") {
    return { error: "Type DELETE to confirm policy deletion." };
  }

  const { data: policyTerm, error: lookupError } = await supabase
    .from("policy_terms")
    .select("id, policy_series_id, policy_number, insured_name_snapshot")
    .eq("id", policyTermId)
    .single();
  if (lookupError) throw lookupError;

  await logActivity(
    supabase,
    userId,
    policyTermId,
    "delete",
    `Deleted policy ${policyTerm.policy_number || policyTerm.insured_name_snapshot || policyTermId}.`,
  );

  const { error: deleteError } = await supabase
    .from("policy_terms")
    .delete()
    .eq("id", policyTermId);
  if (deleteError) throw deleteError;

  const { count, error: countError } = await supabase
    .from("policy_terms")
    .select("id", { count: "exact", head: true })
    .eq("policy_series_id", policyTerm.policy_series_id);
  if (countError) throw countError;

  if (count === 0) {
    await supabase.from("policy_series").delete().eq("id", policyTerm.policy_series_id);
  }

  revalidatePath("/protected");
  redirect("/protected");
}

export async function startRenewal(formData: FormData) {
  const policyTermId = textValue(formData, "policy_term_id");
  const { supabase, userId } = await requireUser();

  const { data: previousTerm, error: termError } = await supabase
    .from("policy_terms")
    .select("*")
    .eq("id", policyTermId)
    .single();
  if (termError) throw termError;

  const effectiveDate = addOneYear(previousTerm.effective_date as string | null);
  const expiryDate = addOneYear(previousTerm.expiry_date as string | null);

  const { data: renewalTerm, error: renewalError } = await supabase
    .from("policy_terms")
    .insert({
      policy_series_id: previousTerm.policy_series_id,
      client_id: previousTerm.client_id,
      insurance_type_id: previousTerm.insurance_type_id,
      insurer_id: previousTerm.insurer_id,
      previous_policy_term_id: previousTerm.id,
      commission_rate_setting_id: previousTerm.commission_rate_setting_id,
      split_pattern_id: previousTerm.split_pattern_id,
      policy_number: null,
      effective_date: effectiveDate,
      expiry_date: expiryDate,
      primary_sum_assured: previousTerm.primary_sum_assured,
      gross_premium: previousTerm.gross_premium,
      net_premium: previousTerm.net_premium,
      gross_commission_percent: previousTerm.gross_commission_percent,
      net_commission_percent: previousTerm.net_commission_percent,
      premium_status: "unpaid",
      term_stage: "quotation",
      quotation_status: "draft",
      policy_status: null,
      renewal_status: "quoting",
      insured_name_snapshot: previousTerm.insured_name_snapshot,
      notes: previousTerm.notes,
    })
    .select("id")
    .single();
  if (renewalError) throw renewalError;

  if (previousTerm.primary_sum_assured !== null) {
    const { error: valueError } = await supabase.from("policy_term_values").insert({
      policy_term_id: renewalTerm.id,
      value_type: "sum_assured",
      amount: previousTerm.primary_sum_assured,
      currency: "MYR",
      notes: "Copied from previous term for renewal quotation.",
    });
    if (valueError) throw valueError;
  }

  await copyTypeSpecificDetails(supabase, previousTerm.id as string, renewalTerm.id as string);

  const today = new Date().toISOString().slice(0, 10);
  await supabase.from("tasks").insert({
    task_type: "renewal",
    policy_term_id: renewalTerm.id,
    client_id: previousTerm.client_id,
    due_date: today,
    status: "pending",
    title: "Prepare renewal quotation",
  });

  const { error: previousUpdateError } = await supabase
    .from("policy_terms")
    .update({
      next_policy_term_id: renewalTerm.id,
      renewal_status: "quoting",
    })
    .eq("id", previousTerm.id);
  if (previousUpdateError) throw previousUpdateError;

  await logActivity(
    supabase,
    userId,
    renewalTerm.id,
    "renewal_created",
    "Created renewal quotation from previous policy term.",
  );

  revalidatePath("/protected");
  revalidatePath(`/protected/policies/${policyTermId}`);
  redirect(`/protected/policies/${renewalTerm.id}/edit`);
}

async function copyTypeSpecificDetails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  previousPolicyTermId: string,
  renewalPolicyTermId: string,
) {
  let motorResult = await supabase
    .from("motor_policy_details")
    .select("vehicle_id, motor_type, type_of_cover, vehicle_no_snapshot, ncd, extra_coverage, bdm, btm, motor_description, notes")
    .eq("policy_term_id", previousPolicyTermId)
    .maybeSingle();
  if (
    motorResult.error &&
    (motorResult.error.message.includes("type_of_cover") ||
      motorResult.error.message.includes("schema cache"))
  ) {
    motorResult = await supabase
      .from("motor_policy_details")
      .select("vehicle_id, motor_type, vehicle_no_snapshot, ncd, extra_coverage, bdm, btm, motor_description, notes")
      .eq("policy_term_id", previousPolicyTermId)
      .maybeSingle();
  }
  if (motorResult.error) throw motorResult.error;
  const motor = motorResult.data;
  if (motor) {
    const { error } = await supabase.from("motor_policy_details").insert({
      ...motor,
      policy_term_id: renewalPolicyTermId,
    });
    if (error) throw error;
    return;
  }

  const { data: fire } = await supabase
    .from("fire_policy_details")
    .select("property_address, risk_location, building_sum_insured, contents_sum_insured, stock_sum_insured, occupation, construction_type, notes")
    .eq("policy_term_id", previousPolicyTermId)
    .maybeSingle();
  if (fire) {
    const { error } = await supabase.from("fire_policy_details").insert({
      ...fire,
      policy_term_id: renewalPolicyTermId,
    });
    if (error) throw error;
    return;
  }

  const { data: marine } = await supabase
    .from("marine_policy_details")
    .select("marine_type, voyage_from, voyage_to, goods_description, sum_insured, notes")
    .eq("policy_term_id", previousPolicyTermId)
    .maybeSingle();
  if (marine) {
    const { error } = await supabase.from("marine_policy_details").insert({
      ...marine,
      policy_term_id: renewalPolicyTermId,
    });
    if (error) throw error;
    return;
  }

  const { data: travel } = await supabase
    .from("travel_policy_details")
    .select("destination, travel_start_date, travel_end_date, pax, plan_name, notes")
    .eq("policy_term_id", previousPolicyTermId)
    .maybeSingle();
  if (travel) {
    const { error } = await supabase.from("travel_policy_details").insert({
      ...travel,
      policy_term_id: renewalPolicyTermId,
    });
    if (error) throw error;
    return;
  }

  const { data: generic } = await supabase
    .from("generic_policy_details")
    .select("detail_type, description, sum_insured, details_json, notes")
    .eq("policy_term_id", previousPolicyTermId)
    .maybeSingle();
  if (generic) {
    const { error } = await supabase.from("generic_policy_details").insert({
      ...generic,
      policy_term_id: renewalPolicyTermId,
    });
    if (error) throw error;
  }
}
