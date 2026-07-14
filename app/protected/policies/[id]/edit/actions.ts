"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type UpdatePolicyState = {
  error?: string;
  success?: string;
};

type SplitRule = {
  payee_id: string;
  rule_type:
    | "net_commission_share"
    | "fixed_percent_of_gross"
    | "remaining_net_after_fixed_percent"
    | "equal_net_share";
  share_percent: string | number | null;
  fixed_percent: string | number | null;
  subtract_percent: string | number | null;
};

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value || null;
}

function moneyValue(formData: FormData, key: string) {
  const raw = textValue(formData, key)
    .replace(/rm/gi, "")
    .replace(/,/g, "")
    .replace(/\s/g, "");
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${key.replaceAll("_", " ")} must be a valid positive number.`);
  }
  return value;
}

function parseDate(formData: FormData, key: string) {
  const raw = textValue(formData, key);
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
  if (!match) {
    throw new Error(`${key.replaceAll("_", " ")} must use dd/mm/yyyy format.`);
  }
  const [, rawDay, rawMonth, rawYear] = match;
  const year =
    rawYear.length === 4 ? rawYear : Number(rawYear) >= 70 ? `19${rawYear}` : `20${rawYear}`;
  const day = rawDay.padStart(2, "0");
  const month = rawMonth.padStart(2, "0");
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCDate() !== Number(day) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCFullYear() !== Number(year)
  ) {
    throw new Error(`${key.replaceAll("_", " ")} is not a valid date.`);
  }
  return `${year}-${month}-${day}`;
}

function percentNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isEquipmentLikeInsurance(code: string | null | undefined) {
  return code === "equipment_insurance" || code === "equipment_all_risk";
}

async function splitPatternRequiresNetPremium(
  supabase: Awaited<ReturnType<typeof createClient>>,
  splitPatternId: string | null,
) {
  if (!splitPatternId) return false;

  const { data, error } = await supabase
    .from("commission_split_rules")
    .select("id")
    .eq("split_pattern_id", splitPatternId)
    .eq("rule_type", "fixed_percent_of_gross")
    .limit(1);
  if (error) throw error;

  return Boolean(data?.length);
}

export async function updatePolicy(
  _previousState: UpdatePolicyState,
  formData: FormData,
): Promise<UpdatePolicyState> {
  try {
    const policyTermId = textValue(formData, "policy_term_id");
    if (!policyTermId) return { error: "Missing policy record." };

    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getClaims();
    if (userError || !userData?.claims) {
      return { error: "You must be logged in." };
    }

    const termStage = textValue(formData, "term_stage") === "quotation" ? "quotation" : "policy";
    const effectiveDate = parseDate(formData, "effective_date");
    const expiryDate = parseDate(formData, "expiry_date");
    if (effectiveDate && expiryDate && expiryDate < effectiveDate) {
      return { error: "Expiry date cannot be before effective date." };
    }

    const splitPatternId = optionalText(formData, "split_pattern_id");
    const grossPremium = moneyValue(formData, "gross_premium");
    const netPremium = moneyValue(formData, "net_premium");
    const primarySumAssured = moneyValue(formData, "primary_sum_assured");

    if ((await splitPatternRequiresNetPremium(supabase, splitPatternId)) && netPremium === null) {
      return { error: "Net premium is required for this split pattern." };
    }

    const { error: updateError } = await supabase
      .from("policy_terms")
      .update({
        insurer_id: textValue(formData, "insurer_id"),
        split_pattern_id: splitPatternId,
        policy_number: optionalText(formData, "policy_number"),
        effective_date: effectiveDate,
        expiry_date: expiryDate,
        primary_sum_assured: primarySumAssured,
        gross_premium: grossPremium,
        net_premium: netPremium,
        premium_status: textValue(formData, "premium_status"),
        term_stage: termStage,
        quotation_status: termStage === "quotation" ? textValue(formData, "quotation_status") : null,
        policy_status: termStage === "policy" ? textValue(formData, "policy_status") : null,
        renewal_status: textValue(formData, "renewal_status"),
        notes: optionalText(formData, "notes"),
      })
      .eq("id", policyTermId);
    if (updateError) throw updateError;

    const { data: termWithType, error: termLookupError } = await supabase
      .from("policy_terms")
      .select("policy_series_id, insurance_types(code, name)")
      .eq("id", policyTermId)
      .single();
    if (termLookupError) throw termLookupError;

    const insuranceType = Array.isArray(termWithType.insurance_types)
      ? termWithType.insurance_types[0]
      : termWithType.insurance_types;
    if (isEquipmentLikeInsurance(insuranceType?.code)) {
      const equipmentVehicleNo = optionalText(formData, "equipment_vehicle_no");
      const equipmentDescription = optionalText(formData, "equipment_description");
      const equipmentSumInsured = moneyValue(formData, "equipment_sum_insured");
      const detailsJson = {
        vehicle_no: equipmentVehicleNo ? equipmentVehicleNo.toUpperCase() : null,
        make_model: optionalText(formData, "equipment_make_model"),
        year: optionalText(formData, "equipment_year"),
        engine_no: optionalText(formData, "equipment_engine_no"),
        chassis_no: optionalText(formData, "equipment_chassis_no"),
      };

      const { data: existingEquipment, error: equipmentLookupError } = await supabase
        .from("generic_policy_details")
        .select("id")
        .eq("policy_term_id", policyTermId)
        .maybeSingle();
      if (equipmentLookupError) throw equipmentLookupError;

      if (existingEquipment?.id) {
        const { error: equipmentUpdateError } = await supabase
          .from("generic_policy_details")
          .update({
            detail_type: insuranceType?.name ?? "Equipment Insurance",
            description: equipmentDescription,
            sum_insured: equipmentSumInsured,
            details_json: detailsJson,
          })
          .eq("id", existingEquipment.id);
        if (equipmentUpdateError) throw equipmentUpdateError;
      } else {
        const { error: equipmentInsertError } = await supabase
          .from("generic_policy_details")
          .insert({
            policy_term_id: policyTermId,
            detail_type: insuranceType?.name ?? "Equipment Insurance",
            description: equipmentDescription,
            sum_insured: equipmentSumInsured,
            details_json: detailsJson,
          });
        if (equipmentInsertError) throw equipmentInsertError;
      }

      if (equipmentVehicleNo) {
        await supabase
          .from("policy_series")
          .update({ primary_risk_label: equipmentVehicleNo.toUpperCase() })
          .eq("id", termWithType.policy_series_id);
      }
    }

    await supabase
      .from("policy_term_values")
      .delete()
      .eq("policy_term_id", policyTermId)
      .eq("value_type", "sum_assured");
    if (primarySumAssured !== null) {
      const { error: valueError } = await supabase.from("policy_term_values").insert({
        policy_term_id: policyTermId,
        value_type: "sum_assured",
        amount: primarySumAssured,
        currency: "MYR",
      });
      if (valueError) throw valueError;
    }

    await recalculateCommissions(
      supabase,
      policyTermId,
      splitPatternId,
      grossPremium,
      netPremium,
    );

    await supabase.from("activity_logs").insert({
      record_type: "policy_term",
      record_id: policyTermId,
      action: "update",
      message: "Updated policy term.",
      created_by: userData.claims.sub,
    });

    revalidatePath("/protected");
    revalidatePath(`/protected/policies/${policyTermId}`);
    revalidatePath(`/protected/policies/${policyTermId}/edit`);

    return { success: "Policy saved." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Policy was not saved.",
    };
  }
}

async function recalculateCommissions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  policyTermId: string,
  splitPatternId: string | null,
  grossPremium: number | null,
  netPremium: number | null,
) {
  if (!splitPatternId || grossPremium === null) return;

  const { data: term, error: termError } = await supabase
    .from("policy_terms")
    .select("net_commission_percent")
    .eq("id", policyTermId)
    .single();
  if (termError) throw termError;
  const netPercent = percentNumber(term.net_commission_percent as string | number | null);
  if (!netPercent) return;

  const { data: rules, error: rulesError } = await supabase
    .from("commission_split_rules")
    .select("payee_id, rule_type, share_percent, fixed_percent, subtract_percent")
    .eq("split_pattern_id", splitPatternId)
    .order("sort_order", { ascending: true });
  if (rulesError) throw rulesError;

  const splitRules = (rules ?? []) as SplitRule[];
  const hasNetPremiumFixedRule = splitRules.some(
    (rule) => rule.rule_type === "fixed_percent_of_gross",
  );
  if (hasNetPremiumFixedRule && netPremium === null) {
    throw new Error("Net premium is required for this split pattern.");
  }

  await supabase.from("commissions").delete().eq("policy_term_id", policyTermId);

  const equalRuleCount =
    splitRules.filter((rule) => rule.rule_type === "equal_net_share").length || 1;
  const totalNetCommissionAmount = grossPremium * netPercent;
  const fixedNetPremiumAmount = splitRules
    .filter((rule) => rule.rule_type === "fixed_percent_of_gross")
    .reduce(
      (total, rule) => total + (netPremium ?? 0) * percentNumber(rule.fixed_percent),
      0,
    );

  const commissions = splitRules.map((rule) => {
    let calculationPercent = 0;
    let amount = 0;

    if (rule.rule_type === "net_commission_share") {
      calculationPercent = netPercent * percentNumber(rule.share_percent);
      amount = grossPremium * calculationPercent;
    } else if (rule.rule_type === "fixed_percent_of_gross") {
      calculationPercent = percentNumber(rule.fixed_percent);
      amount = (netPremium ?? 0) * calculationPercent;
    } else if (rule.rule_type === "remaining_net_after_fixed_percent") {
      amount = Math.max(totalNetCommissionAmount - fixedNetPremiumAmount, 0);
      calculationPercent = grossPremium ? amount / grossPremium : 0;
    } else if (rule.rule_type === "equal_net_share") {
      calculationPercent = netPercent / equalRuleCount;
      amount = grossPremium * calculationPercent;
    }

    const roundedAmount = Math.round(amount * 100) / 100;
    return {
      policy_term_id: policyTermId,
      payee_id: rule.payee_id,
      split_pattern_id: splitPatternId,
      calculation_percent: calculationPercent,
      amount: roundedAmount,
      unpaid_amount: roundedAmount,
      status: "unpaid",
    };
  });

  if (commissions.length) {
    const { error } = await supabase.from("commissions").insert(commissions);
    if (error) throw error;
  }
}
