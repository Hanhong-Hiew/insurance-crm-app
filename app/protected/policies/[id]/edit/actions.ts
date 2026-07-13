"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

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
  const raw = textValue(formData, key).replace(/,/g, "");
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
  const match = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (!match) {
    throw new Error(`${key.replaceAll("_", " ")} must use dd/mm/yyyy format.`);
  }
  const [, rawDay, rawMonth, year] = match;
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

export async function updatePolicy(formData: FormData) {
  const policyTermId = textValue(formData, "policy_term_id");
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();
  if (userError || !userData?.claims) {
    throw new Error("You must be logged in.");
  }

  const termStage = textValue(formData, "term_stage") === "quotation" ? "quotation" : "policy";
  const effectiveDate = parseDate(formData, "effective_date");
  const expiryDate = parseDate(formData, "expiry_date");
  if (effectiveDate && expiryDate && expiryDate < effectiveDate) {
    throw new Error("Expiry date cannot be before effective date.");
  }

  const splitPatternId = optionalText(formData, "split_pattern_id");
  const grossPremium = moneyValue(formData, "gross_premium");
  const primarySumAssured = moneyValue(formData, "primary_sum_assured");

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
      net_premium: moneyValue(formData, "net_premium"),
      premium_status: textValue(formData, "premium_status"),
      term_stage: termStage,
      quotation_status: termStage === "quotation" ? textValue(formData, "quotation_status") : null,
      policy_status: termStage === "policy" ? textValue(formData, "policy_status") : null,
      renewal_status: textValue(formData, "renewal_status"),
      notes: optionalText(formData, "notes"),
    })
    .eq("id", policyTermId);
  if (updateError) throw updateError;

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

  await recalculateCommissions(supabase, policyTermId, splitPatternId, grossPremium);

  await supabase.from("activity_logs").insert({
    record_type: "policy_term",
    record_id: policyTermId,
    action: "update",
    message: "Updated policy term.",
    created_by: userData.claims.sub,
  });

  revalidatePath("/protected");
  revalidatePath(`/protected/policies/${policyTermId}`);
  redirect(`/protected/policies/${policyTermId}`);
}

async function recalculateCommissions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  policyTermId: string,
  splitPatternId: string | null,
  grossPremium: number | null,
) {
  await supabase.from("commissions").delete().eq("policy_term_id", policyTermId);
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
  const equalRuleCount =
    splitRules.filter((rule) => rule.rule_type === "equal_net_share").length || 1;

  const commissions = splitRules.map((rule) => {
    let calculationPercent = 0;
    if (rule.rule_type === "net_commission_share") {
      calculationPercent = netPercent * percentNumber(rule.share_percent);
    } else if (rule.rule_type === "fixed_percent_of_gross") {
      calculationPercent = percentNumber(rule.fixed_percent);
    } else if (rule.rule_type === "remaining_net_after_fixed_percent") {
      calculationPercent = Math.max(netPercent - percentNumber(rule.subtract_percent), 0);
    } else if (rule.rule_type === "equal_net_share") {
      calculationPercent = netPercent / equalRuleCount;
    }

    const amount = Math.round(grossPremium * calculationPercent * 100) / 100;
    return {
      policy_term_id: policyTermId,
      payee_id: rule.payee_id,
      split_pattern_id: splitPatternId,
      calculation_percent: calculationPercent,
      amount,
      unpaid_amount: amount,
      status: "unpaid",
    };
  });

  if (commissions.length) {
    const { error } = await supabase.from("commissions").insert(commissions);
    if (error) throw error;
  }
}
