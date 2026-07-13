"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type SavePolicyState = {
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
  const raw = textValue(formData, key).replace(/,/g, "");
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${key} must be a valid positive number.`);
  }
  return value;
}

function percentNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(formData: FormData, key: string) {
  const raw = textValue(formData, key);
  if (!raw) return null;

  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    throw new Error(`${key} must use dd/mm/yyyy format.`);
  }

  const [, day, month, year] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCDate() !== Number(day) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCFullYear() !== Number(year)
  ) {
    throw new Error(`${key} is not a valid date.`);
  }

  return `${year}-${month}-${day}`;
}

function normalizeVehicleNo(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function savePolicy(
  _previousState: SavePolicyState,
  formData: FormData,
): Promise<SavePolicyState> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData?.claims) {
    return { error: "You must be logged in to save a policy." };
  }

  try {
    const clientName = textValue(formData, "client_name");
    const insuranceTypeId = textValue(formData, "insurance_type_id");
    const insurerId = textValue(formData, "insurer_id");
    const splitPatternId = optionalText(formData, "split_pattern_id");
    const policyNumber = optionalText(formData, "policy_number");
    const riskLabel = textValue(formData, "risk_label");
    const effectiveDate = parseDate(formData, "effective_date");
    const expiryDate = parseDate(formData, "expiry_date");
    const primarySumAssured = moneyValue(formData, "primary_sum_assured");
    const grossPremium = moneyValue(formData, "gross_premium");
    const netPremium = moneyValue(formData, "net_premium");
    const notes = optionalText(formData, "notes");

    if (!clientName) return { error: "Client name is required." };
    if (!insuranceTypeId) return { error: "Insurance type is required." };
    if (!insurerId) return { error: "Insurer is required." };
    if (!effectiveDate) return { error: "Effective date is required." };
    if (!expiryDate) return { error: "Expiry date is required." };
    if (expiryDate < effectiveDate) {
      return { error: "Expiry date cannot be before effective date." };
    }

    const { data: insuranceType, error: insuranceTypeError } = await supabase
      .from("insurance_types")
      .select("id, code, name")
      .eq("id", insuranceTypeId)
      .single();
    if (insuranceTypeError) throw insuranceTypeError;

    const { data: existingClient, error: existingClientError } = await supabase
      .from("clients")
      .select("id")
      .eq("client_name", clientName)
      .maybeSingle();
    if (existingClientError) throw existingClientError;

    let clientId = existingClient?.id as string | undefined;
    if (!clientId) {
      const { data: createdClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          client_name: clientName,
          client_type: "individual",
        })
        .select("id")
        .single();
      if (clientError) throw clientError;
      clientId = createdClient.id as string;
    }

    const seriesRiskLabel = riskLabel || policyNumber || clientName;
    const { data: policySeries, error: seriesError } = await supabase
      .from("policy_series")
      .insert({
        client_id: clientId,
        insurance_type_id: insuranceTypeId,
        series_name: `${clientName} - ${insuranceType.name ?? "Policy"}`,
        primary_risk_label: seriesRiskLabel,
        status: "active",
      })
      .select("id")
      .single();
    if (seriesError) throw seriesError;

    const { data: rateSetting, error: rateError } = await supabase
      .from("commission_rate_settings")
      .select("id, gross_commission_percent, net_commission_percent")
      .eq("insurance_type_id", insuranceTypeId)
      .eq("active", true)
      .is("effective_to", null)
      .maybeSingle();
    if (rateError) throw rateError;

    const grossCommissionPercent = rateSetting?.gross_commission_percent ?? null;
    const netCommissionPercent = rateSetting?.net_commission_percent ?? null;

    const { data: policyTerm, error: termError } = await supabase
      .from("policy_terms")
      .insert({
        policy_series_id: policySeries.id,
        client_id: clientId,
        insurance_type_id: insuranceTypeId,
        insurer_id: insurerId,
        commission_rate_setting_id: rateSetting?.id ?? null,
        split_pattern_id: splitPatternId,
        policy_number: policyNumber,
        effective_date: effectiveDate,
        expiry_date: expiryDate,
        primary_sum_assured: primarySumAssured,
        gross_premium: grossPremium,
        net_premium: netPremium,
        gross_commission_percent: grossCommissionPercent,
        net_commission_percent: netCommissionPercent,
        premium_status: "unpaid",
        term_stage: "policy",
        quotation_status: null,
        policy_status: "active",
        renewal_status: "not_started",
        insured_name_snapshot: clientName,
        notes,
      })
      .select("id")
      .single();
    if (termError) throw termError;

    if (primarySumAssured !== null) {
      const { error: valueError } = await supabase
        .from("policy_term_values")
        .insert({
          policy_term_id: policyTerm.id,
          value_type: "sum_assured",
          amount: primarySumAssured,
          currency: "MYR",
        });
      if (valueError) throw valueError;
    }

    if (insuranceType.code === "motor" && riskLabel) {
      const normalized = normalizeVehicleNo(riskLabel);
      if (normalized) {
        const { data: existingVehicle, error: vehicleLookupError } = await supabase
          .from("vehicles")
          .select("id")
          .eq("vehicle_no_normalized", normalized)
          .maybeSingle();
        if (vehicleLookupError) throw vehicleLookupError;

        let vehicleId = existingVehicle?.id as string | undefined;
        if (!vehicleId) {
          const { data: createdVehicle, error: vehicleError } = await supabase
            .from("vehicles")
            .insert({
              vehicle_no: riskLabel.toUpperCase(),
              vehicle_no_normalized: normalized,
            })
            .select("id")
            .single();
          if (vehicleError) throw vehicleError;
          vehicleId = createdVehicle.id as string;
        }

        const { error: motorError } = await supabase
          .from("motor_policy_details")
          .insert({
            policy_term_id: policyTerm.id,
            vehicle_id: vehicleId,
            vehicle_no_snapshot: riskLabel.toUpperCase(),
          });
        if (motorError) throw motorError;
      }
    }

    if (splitPatternId && grossPremium !== null && netCommissionPercent !== null) {
      const { data: rules, error: rulesError } = await supabase
        .from("commission_split_rules")
        .select("payee_id, rule_type, share_percent, fixed_percent, subtract_percent")
        .eq("split_pattern_id", splitPatternId)
        .order("sort_order", { ascending: true });
      if (rulesError) throw rulesError;

      const splitRules = (rules ?? []) as SplitRule[];
      const equalRuleCount =
        splitRules.filter((rule) => rule.rule_type === "equal_net_share").length || 1;
      const netPercent = percentNumber(netCommissionPercent);

      const commissions = splitRules.map((rule) => {
        let calculationPercent = 0;

        if (rule.rule_type === "net_commission_share") {
          calculationPercent = netPercent * percentNumber(rule.share_percent);
        } else if (rule.rule_type === "fixed_percent_of_gross") {
          calculationPercent = percentNumber(rule.fixed_percent);
        } else if (rule.rule_type === "remaining_net_after_fixed_percent") {
          calculationPercent = Math.max(
            netPercent - percentNumber(rule.subtract_percent),
            0,
          );
        } else if (rule.rule_type === "equal_net_share") {
          calculationPercent = netPercent / equalRuleCount;
        }

        const amount = Math.round(grossPremium * calculationPercent * 100) / 100;

        return {
          policy_term_id: policyTerm.id,
          payee_id: rule.payee_id,
          split_pattern_id: splitPatternId,
          calculation_percent: calculationPercent,
          amount,
          unpaid_amount: amount,
          status: "unpaid",
        };
      });

      if (commissions.length) {
        const { error: commissionError } = await supabase
          .from("commissions")
          .insert(commissions);
        if (commissionError) throw commissionError;
      }
    }

    await supabase.from("activity_logs").insert({
      record_type: "policy_term",
      record_id: policyTerm.id,
      action: "create",
      message: `Created policy for ${clientName}`,
      created_by: userData.claims.sub,
    });

    revalidatePath("/protected");
    revalidatePath("/protected/new-policy");

    return { success: "Policy saved." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Policy could not be saved.",
    };
  }
}
