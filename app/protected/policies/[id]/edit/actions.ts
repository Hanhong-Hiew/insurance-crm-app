"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { roundMoney } from "@/lib/commission";

export type UpdatePolicyState = {
  error?: string;
  success?: string;
};

type SplitRule = {
  payee_id: string;
  rule_type:
    | "gross_commission_share"
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

function allTextValues(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

function moneyValue(formData: FormData, key: string) {
  return moneyValueFromText(textValue(formData, key), key);
}

function moneyValueFromText(rawText: string, key = "amount") {
  const raw = rawText
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

function integerValue(formData: FormData, key: string) {
  const raw = textValue(formData, key).replace(/,/g, "");
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${key.replaceAll("_", " ")} must be a valid whole number.`);
  }
  return value;
}

function ncdValue(formData: FormData, key: string) {
  const raw = textValue(formData, key).replace("%", "");
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${key.replaceAll("_", " ")} must be a valid percentage.`);
  }
  const normalized = value > 1 ? value / 100 : value;
  if (normalized > 1) {
    throw new Error(`${key.replaceAll("_", " ")} cannot be more than 100%.`);
  }
  return normalized;
}

function normalizeVehicleNo(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cleanClientType(value: string) {
  return value === "company" || value === "other" ? value : "individual";
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

function isFireLikeInsurance(code: string | null | undefined) {
  return code === "fire" || code === "home_insurance" || code === "industrial_all_risk";
}

async function upsertPolicyDetail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  policyTermId: string,
  values: Record<string, unknown>,
) {
  const { data: existing, error: lookupError } = await supabase
    .from(table)
    .select("id")
    .eq("policy_term_id", policyTermId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing?.id) {
    const { error } = await supabase.from(table).update(values).eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from(table).insert({
    policy_term_id: policyTermId,
    ...values,
  });
  if (error) throw error;
}

function readableError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code]
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    if (parts.length) return parts.join(" ");
  }
  return fallback;
}

export async function updatePolicy(
  _previousState: UpdatePolicyState,
  formData: FormData,
): Promise<UpdatePolicyState> {
  try {
    const policyTermId = textValue(formData, "policy_term_id");
    if (!policyTermId) return { error: "Missing policy record." };
    const clientName = textValue(formData, "client_name");
    if (!clientName) return { error: "Client name is required." };

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
    const businessRegistrationNo = optionalText(formData, "business_registration_no");
    const clientType = cleanClientType(textValue(formData, "client_type"));
    const clientReferral = optionalText(formData, "client_referral");
    const clientPhone = optionalText(formData, "client_phone");
    const clientEmail = optionalText(formData, "client_email");
    const clientAddress = optionalText(formData, "client_address");
    const selectedClientAddressId = optionalText(formData, "selected_client_address_id");
    const clientAddressLabel = optionalText(formData, "client_address_label");
    const insuranceTypeId = textValue(formData, "insurance_type_id");
    const insurerId = textValue(formData, "insurer_id");

    if (!insuranceTypeId) return { error: "Risk is required." };
    if (!insurerId) return { error: "Insurer is required." };

    const { data: selectedInsuranceType, error: insuranceTypeError } = await supabase
      .from("insurance_types")
      .select("id, code, name")
      .eq("id", insuranceTypeId)
      .single();
    if (insuranceTypeError) throw insuranceTypeError;
    const insuranceCode = String(selectedInsuranceType?.code ?? "").trim().toLowerCase();

    const { data: rateSetting, error: rateSettingError } = await supabase
      .from("commission_rate_settings")
      .select("gross_commission_percent, net_commission_percent")
      .eq("insurance_type_id", insuranceTypeId)
      .eq("active", true)
      .is("effective_to", null)
      .maybeSingle();
    if (rateSettingError) throw rateSettingError;

    const { error: updateError } = await supabase
      .from("policy_terms")
      .update({
        insurance_type_id: insuranceTypeId,
        insurer_id: insurerId,
        split_pattern_id: splitPatternId,
        policy_number: optionalText(formData, "policy_number"),
        effective_date: effectiveDate,
        expiry_date: expiryDate,
        primary_sum_assured: primarySumAssured,
        gross_premium: grossPremium,
        gross_commission_percent: rateSetting?.gross_commission_percent ?? null,
        net_premium: netPremium,
        net_commission_percent: rateSetting?.net_commission_percent ?? null,
        premium_status: textValue(formData, "premium_status"),
        term_stage: termStage,
        quotation_status: termStage === "quotation" ? textValue(formData, "quotation_status") : null,
        policy_status: termStage === "policy" ? textValue(formData, "policy_status") : null,
        renewal_status: textValue(formData, "renewal_status"),
        insured_name_snapshot: clientName,
        notes: optionalText(formData, "notes"),
      })
      .eq("id", policyTermId);
    if (updateError) throw updateError;

    const { data: termWithType, error: termLookupError } = await supabase
      .from("policy_terms")
      .select("client_id, policy_series_id")
      .eq("id", policyTermId)
      .single();
    if (termLookupError) throw termLookupError;

    if (termWithType.client_id) {
      const { error: clientUpdateError } = await supabase
        .from("clients")
        .update({
          business_registration_no: businessRegistrationNo,
          client_name: clientName,
          client_type: clientType,
          email: clientEmail,
          phone: clientPhone,
          referral: clientReferral,
        })
        .eq("id", termWithType.client_id);
      if (clientUpdateError) throw clientUpdateError;
    }

    let clientAddressId: string | null = null;
    if (termWithType.client_id && clientAddress) {
      if (selectedClientAddressId) {
        const { data: existingAddress, error: addressLookupError } = await supabase
          .from("client_addresses")
          .select("id")
          .eq("id", selectedClientAddressId)
          .eq("client_id", termWithType.client_id)
          .maybeSingle();
        if (addressLookupError) throw addressLookupError;

        if (existingAddress?.id) {
          const { error: addressUpdateError } = await supabase
            .from("client_addresses")
            .update({
              address: clientAddress,
              address_label: clientAddressLabel,
            })
            .eq("id", existingAddress.id);
          if (addressUpdateError) throw addressUpdateError;
          clientAddressId = existingAddress.id as string;
        }
      }

      if (!clientAddressId) {
        const { data: createdAddress, error: addressCreateError } = await supabase
          .from("client_addresses")
          .insert({
            client_id: termWithType.client_id,
            address: clientAddress,
            address_label: clientAddressLabel,
            is_default: false,
          })
          .select("id")
          .single();
        if (addressCreateError) throw addressCreateError;
        clientAddressId = createdAddress.id as string;
      }

      const { error: termAddressUpdateError } = await supabase
        .from("policy_terms")
        .update({ client_address_id: clientAddressId })
        .eq("id", policyTermId);
      if (termAddressUpdateError) throw termAddressUpdateError;
    }

    if (insuranceCode === "motor") {
      const vehicleNo = textValue(formData, "vehicle_no");
      if (!vehicleNo) return { error: "Vehicle number is required for motor policies." };

      const normalized = normalizeVehicleNo(vehicleNo);
      const stableVehicleFields = {
        make_model: optionalText(formData, "make_model"),
        year_of_manufacture: integerValue(formData, "year_of_manufacture"),
        engine_cc: integerValue(formData, "engine_cc"),
        engine_no: optionalText(formData, "engine_no"),
        chassis_no: optionalText(formData, "chassis_no"),
      };
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
            vehicle_no: vehicleNo.toUpperCase(),
            vehicle_no_normalized: normalized,
            ...stableVehicleFields,
          })
          .select("id")
          .single();
        if (vehicleError) throw vehicleError;
        vehicleId = createdVehicle.id as string;
      } else {
        const vehicleUpdate = Object.fromEntries(
          Object.entries(stableVehicleFields).filter(([, value]) => value !== null),
        );
        if (Object.keys(vehicleUpdate).length) {
          const { error: vehicleUpdateError } = await supabase
            .from("vehicles")
            .update(vehicleUpdate)
            .eq("id", vehicleId);
          if (vehicleUpdateError) throw vehicleUpdateError;
        }
      }

      const motorDetails = {
        vehicle_id: vehicleId,
        motor_type: optionalText(formData, "motor_type"),
        type_of_cover: optionalText(formData, "type_of_cover"),
        vehicle_no_snapshot: vehicleNo.toUpperCase(),
        ncd: ncdValue(formData, "ncd"),
        extra_coverage: optionalText(formData, "extra_coverage"),
        bdm: moneyValue(formData, "bdm"),
        btm: moneyValue(formData, "btm"),
        motor_description: optionalText(formData, "motor_description"),
      };
      try {
        await upsertPolicyDetail(supabase, "motor_policy_details", policyTermId, motorDetails);
      } catch (error) {
        const message = readableError(error, "");
        if (
          message.includes("type_of_cover") ||
          message.includes("schema cache")
        ) {
          const motorDetailsWithoutCover: Record<string, unknown> = { ...motorDetails };
          delete motorDetailsWithoutCover.type_of_cover;
          await upsertPolicyDetail(
            supabase,
            "motor_policy_details",
            policyTermId,
            motorDetailsWithoutCover,
          );
        } else {
          throw error;
        }
      }

      await supabase
        .from("policy_series")
        .update({ primary_risk_label: vehicleNo.toUpperCase() })
        .eq("id", termWithType.policy_series_id);
    } else if (isFireLikeInsurance(insuranceCode)) {
      const propertyAddress = optionalText(formData, "property_address") || clientAddress;
      await upsertPolicyDetail(supabase, "fire_policy_details", policyTermId, {
        property_address: propertyAddress,
        risk_location: propertyAddress,
        occupation: optionalText(formData, "occupation"),
        construction_type: optionalText(formData, "construction_type"),
      });
    } else if (insuranceCode === "marine_insurance") {
      await upsertPolicyDetail(supabase, "marine_policy_details", policyTermId, {
        marine_type: optionalText(formData, "marine_type"),
        voyage_from: optionalText(formData, "voyage_from"),
        voyage_to: optionalText(formData, "voyage_to"),
        goods_description: optionalText(formData, "goods_description"),
      });
    } else if (insuranceCode === "travel") {
      await upsertPolicyDetail(supabase, "travel_policy_details", policyTermId, {
        destination: optionalText(formData, "destination"),
        pax: integerValue(formData, "pax"),
        plan_name: optionalText(formData, "plan_name"),
      });
    } else if (isEquipmentLikeInsurance(insuranceCode)) {
      const equipmentVehicleNo = optionalText(formData, "equipment_vehicle_no");
      const equipmentDescription = optionalText(formData, "equipment_description");
      const detailsJson = {
        vehicle_no: equipmentVehicleNo ? equipmentVehicleNo.toUpperCase() : null,
        make_model: optionalText(formData, "equipment_make_model"),
        year: optionalText(formData, "equipment_year"),
        engine_no: optionalText(formData, "equipment_engine_no"),
        chassis_no: optionalText(formData, "equipment_chassis_no"),
      };

      await upsertPolicyDetail(supabase, "generic_policy_details", policyTermId, {
        detail_type: selectedInsuranceType?.name ?? "Equipment Insurance",
        description: equipmentDescription,
        sum_insured: null,
        details_json: detailsJson,
      });

      if (equipmentVehicleNo) {
        await supabase
          .from("policy_series")
          .update({ primary_risk_label: equipmentVehicleNo.toUpperCase() })
          .eq("id", termWithType.policy_series_id);
      }
    } else {
      await upsertPolicyDetail(supabase, "generic_policy_details", policyTermId, {
        detail_type: optionalText(formData, "generic_detail_type"),
        description: optionalText(formData, "generic_description"),
        sum_insured: null,
      });
    }

    if (insuranceCode !== "motor" && !isEquipmentLikeInsurance(insuranceCode)) {
      const riskLabel =
        optionalText(formData, "risk_label") ||
        optionalText(formData, "property_address") ||
        optionalText(formData, "voyage_from") ||
        optionalText(formData, "voyage_to") ||
        optionalText(formData, "goods_description") ||
        optionalText(formData, "destination") ||
        optionalText(formData, "policy_number") ||
        optionalText(formData, "generic_description");
      await supabase
        .from("policy_series")
        .update({ primary_risk_label: riskLabel })
        .eq("id", termWithType.policy_series_id);
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
      formData,
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
      error: readableError(error, "Policy was not saved."),
    };
  }
}

async function recalculateCommissions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  policyTermId: string,
  splitPatternId: string | null,
  grossPremium: number | null,
  formData: FormData,
) {
  if (!splitPatternId || grossPremium === null) return;

  const { data: term, error: termError } = await supabase
    .from("policy_terms")
    .select("gross_commission_percent, net_commission_percent")
    .eq("id", policyTermId)
    .single();
  if (termError) throw termError;
  const grossPercent = percentNumber(term.gross_commission_percent as string | number | null);
  const netPercent = percentNumber(term.net_commission_percent as string | number | null);
  if (!grossPercent && !netPercent) return;

  const { data: rules, error: rulesError } = await supabase
    .from("commission_split_rules")
    .select("payee_id, rule_type, share_percent, fixed_percent, subtract_percent")
    .eq("split_pattern_id", splitPatternId)
    .order("sort_order", { ascending: true });
  if (rulesError) throw rulesError;

  const splitRules = (rules ?? []) as SplitRule[];

  const customCommissionEnabled = textValue(formData, "custom_commission_enabled") === "yes";
  const customReason = optionalText(formData, "custom_commission_reason");
  const customReasonSnapshot = customReason ?? "Manual commission override";

  const customPayeeIds = allTextValues(formData, "custom_commission_payee_id");
  const customAmounts = allTextValues(formData, "custom_commission_amount");
  const customPercents = allTextValues(formData, "custom_commission_percent");
  const customByPayee = new Map(
    customPayeeIds.map((payeeId, index) => [
      payeeId,
      {
        amount: moneyValueFromText(customAmounts[index] ?? ""),
        percent: Number(customPercents[index] ?? 0),
      },
    ]),
  );

  const { data: lockedRows, error: lockedError } = await supabase
    .from("commissions")
    .select("payee_id")
    .eq("policy_term_id", policyTermId)
    .or("status.eq.paid,is_custom.eq.true");
  if (lockedError) throw lockedError;
  const lockedPayeeIds = new Set((lockedRows ?? []).map((row) => row.payee_id as string));

  if (customCommissionEnabled) {
    await supabase
      .from("commissions")
      .delete()
      .eq("policy_term_id", policyTermId)
      .neq("status", "paid");
  } else {
    await supabase
      .from("commissions")
      .delete()
      .eq("policy_term_id", policyTermId)
      .neq("status", "paid")
      .eq("is_custom", false);
  }

  const equalRuleCount =
    splitRules.filter((rule) => rule.rule_type === "equal_net_share").length || 1;
  const totalNetCommissionAmount = grossPremium * netPercent;
  const fixedGrossPremiumAmount = splitRules
    .filter((rule) => rule.rule_type === "fixed_percent_of_gross")
    .reduce(
      (total, rule) => total + grossPremium * percentNumber(rule.fixed_percent),
      0,
    );

  const commissions = splitRules.flatMap((rule) => {
    if (lockedPayeeIds.has(rule.payee_id)) return [];
    let calculationPercent = 0;
    let amount = 0;

    if (rule.rule_type === "gross_commission_share") {
      calculationPercent = grossPercent * percentNumber(rule.share_percent);
      amount = grossPremium * calculationPercent;
    } else if (rule.rule_type === "net_commission_share") {
      calculationPercent = netPercent * percentNumber(rule.share_percent);
      amount = grossPremium * calculationPercent;
    } else if (rule.rule_type === "fixed_percent_of_gross") {
      calculationPercent = percentNumber(rule.fixed_percent);
      amount = grossPremium * calculationPercent;
    } else if (rule.rule_type === "remaining_net_after_fixed_percent") {
      amount = Math.max(totalNetCommissionAmount - fixedGrossPremiumAmount, 0);
      calculationPercent = grossPremium ? amount / grossPremium : 0;
    } else if (rule.rule_type === "equal_net_share") {
      calculationPercent = netPercent / equalRuleCount;
      amount = grossPremium * calculationPercent;
    }

    const roundedAmount = roundMoney(amount);
    const custom = customByPayee.get(rule.payee_id);
    const finalAmount =
      customCommissionEnabled && custom ? roundMoney(custom.amount ?? 0) : roundedAmount;
    const finalPercent =
      customCommissionEnabled && custom
        ? custom.percent || (grossPremium ? finalAmount / grossPremium : calculationPercent)
        : calculationPercent;

    return [{
      policy_term_id: policyTermId,
      payee_id: rule.payee_id,
      split_pattern_id: splitPatternId,
      auto_calculation_percent: calculationPercent,
      auto_amount: roundedAmount,
      calculation_percent: finalPercent,
      amount: finalAmount,
      unpaid_amount: finalAmount,
      is_custom: customCommissionEnabled,
      custom_reason: customCommissionEnabled ? customReasonSnapshot : null,
      customized_at: customCommissionEnabled ? new Date().toISOString() : null,
      status: "unpaid",
    }];
  });

  if (commissions.length) {
    const { error } = await supabase.from("commissions").insert(commissions);
    if (error) throw error;
  }
}
