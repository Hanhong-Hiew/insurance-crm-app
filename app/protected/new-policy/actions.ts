"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type SavePolicyState = {
  error?: string;
  success?: string;
  warning?: string;
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

function percentNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeYear(rawYear: string) {
  if (rawYear.length === 4) return rawYear;
  return Number(rawYear) >= 70 ? `19${rawYear}` : `20${rawYear}`;
}

function parseDate(formData: FormData, key: string) {
  const raw = textValue(formData, key);
  if (!raw) return null;

  const match = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
  if (!match) {
    throw new Error(`${key.replaceAll("_", " ")} must use dd/mm/yyyy format.`);
  }

  const [, rawDay, rawMonth, rawYear] = match;
  const year = normalizeYear(rawYear);
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

function normalizeVehicleNo(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cleanInsuranceCode(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function cleanClientType(value: string) {
  return value === "company" || value === "other" ? value : "individual";
}

function cleanPremiumStatus(value: string) {
  return value === "paid" || value === "partial" ? value : "unpaid";
}

function isFireLikeInsurance(code: string) {
  return code === "fire" || code === "home_insurance" || code === "industrial_all_risk";
}

function isEquipmentLikeInsurance(code: string) {
  return code === "equipment_insurance" || code === "equipment_all_risk";
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

export async function savePolicy(
  _previousState: SavePolicyState,
  formData: FormData,
): Promise<SavePolicyState> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData?.claims) {
    return { error: "You must be logged in to save a policy." };
  }

  let createdPolicySeriesId: string | null = null;
  let createdPolicyTermId: string | null = null;
  let createdClientId: string | null = null;

  try {
    const warnings: string[] = [];
    const clientName = textValue(formData, "client_name");
    const selectedClientId = optionalText(formData, "selected_client_id");
    const businessRegistrationNo = optionalText(formData, "business_registration_no");
    const clientType = cleanClientType(textValue(formData, "client_type"));
    const clientPhone = optionalText(formData, "client_phone");
    const clientEmail = optionalText(formData, "client_email");
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
    const premiumStatus = cleanPremiumStatus(textValue(formData, "premium_status"));
    const termStage = textValue(formData, "term_stage") === "quotation" ? "quotation" : "policy";
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

    const insuranceCode = cleanInsuranceCode(insuranceType.code as string | null);
    const vehicleNo = textValue(formData, "vehicle_no");
    const equipmentVehicleNo = textValue(formData, "equipment_vehicle_no");
    const isEquipmentPolicy = isEquipmentLikeInsurance(insuranceCode);
    const resolvedRiskLabel =
      insuranceCode === "motor"
        ? vehicleNo
        : isEquipmentPolicy
          ? equipmentVehicleNo || riskLabel || policyNumber || clientName
        : riskLabel || policyNumber || clientName;

    if (insuranceCode === "motor" && !vehicleNo) {
      return { error: "Vehicle number is required for motor policies." };
    }

    let existingClient: {
      id: string;
      business_registration_no: string | null;
      client_type: string | null;
      phone: string | null;
      email: string | null;
    } | null = null;

    if (selectedClientId) {
      const { data, error } = await supabase
        .from("clients")
        .select("id, business_registration_no, client_type, phone, email")
        .eq("id", selectedClientId)
        .maybeSingle();
      if (error) throw error;
      existingClient = data;
    }

    if (!existingClient && businessRegistrationNo) {
      const { data, error } = await supabase
        .from("clients")
        .select("id, business_registration_no, client_type, phone, email")
        .eq("business_registration_no", businessRegistrationNo)
        .maybeSingle();
      if (error) throw error;
      existingClient = data;
    }

    if (!existingClient) {
      const { data, error } = await supabase
        .from("clients")
        .select("id, business_registration_no, client_type, phone, email")
        .eq("client_name", clientName)
        .maybeSingle();
      if (error) throw error;
      existingClient = data;
    }

    let clientId = existingClient?.id as string | undefined;
    const existingClientRegistrationNo = existingClient?.business_registration_no ?? null;
    if (!clientId) {
      const { data: createdClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          client_name: clientName,
          business_registration_no: businessRegistrationNo,
          client_type: clientType,
          phone: clientPhone,
          email: clientEmail,
        })
        .select("id")
        .single();
      if (clientError) throw clientError;
      clientId = createdClient.id as string;
      createdClientId = clientId;
    } else if (
      existingClient &&
      (businessRegistrationNo || clientPhone || clientEmail || selectedClientId)
    ) {
      const clientUpdate: Record<string, string | null> = {};
      if (businessRegistrationNo && existingClientRegistrationNo !== businessRegistrationNo) {
        clientUpdate.business_registration_no = businessRegistrationNo;
      }

      if (selectedClientId) {
        if (existingClient.client_type !== clientType) clientUpdate.client_type = clientType;
        if (clientPhone !== existingClient.phone) clientUpdate.phone = clientPhone;
        if (clientEmail !== existingClient.email) clientUpdate.email = clientEmail;
      } else {
        if (clientPhone && !existingClient.phone) clientUpdate.phone = clientPhone;
        if (clientEmail && !existingClient.email) clientUpdate.email = clientEmail;
      }

      if (Object.keys(clientUpdate).length) {
        const { error: clientUpdateError } = await supabase
          .from("clients")
          .update(clientUpdate)
          .eq("id", clientId);
        if (clientUpdateError) throw clientUpdateError;
      }
    }

    const { data: policySeries, error: seriesError } = await supabase
      .from("policy_series")
      .insert({
        client_id: clientId,
        insurance_type_id: insuranceTypeId,
        series_name: `${clientName} - ${insuranceType.name ?? "Policy"}`,
        primary_risk_label: resolvedRiskLabel,
        status: "active",
      })
      .select("id")
      .single();
    if (seriesError) throw seriesError;
    createdPolicySeriesId = policySeries.id as string;

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
        premium_status: premiumStatus,
        term_stage: termStage,
        quotation_status: termStage === "quotation" ? "draft" : null,
        policy_status: termStage === "policy" ? "active" : null,
        renewal_status: termStage === "quotation" ? "quoting" : "not_started",
        insured_name_snapshot: clientName,
        notes,
      })
      .select("id")
      .single();
    if (termError) throw termError;
    createdPolicyTermId = policyTerm.id as string;

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

    if (insuranceCode === "motor") {
      const normalized = normalizeVehicleNo(vehicleNo);
      if (normalized) {
        const { data: existingVehicle, error: vehicleLookupError } = await supabase
          .from("vehicles")
          .select("id, make_model, year_of_manufacture, engine_cc, engine_no, chassis_no")
          .eq("vehicle_no_normalized", normalized)
          .maybeSingle();
        if (vehicleLookupError) throw vehicleLookupError;

        const stableVehicleFields = {
          make_model: optionalText(formData, "make_model"),
          year_of_manufacture: integerValue(formData, "year_of_manufacture"),
          engine_cc: integerValue(formData, "engine_cc"),
          engine_no: optionalText(formData, "engine_no"),
          chassis_no: optionalText(formData, "chassis_no"),
        };

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
          policy_term_id: policyTerm.id,
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
        let { error: motorError } = await supabase
          .from("motor_policy_details")
          .insert(motorDetails);
        if (
          motorError &&
          (motorError.message.includes("type_of_cover") ||
            motorError.message.includes("schema cache"))
        ) {
          const motorDetailsWithoutCover: Record<string, unknown> = { ...motorDetails };
          delete motorDetailsWithoutCover.type_of_cover;
          const retryResult = await supabase
            .from("motor_policy_details")
            .insert(motorDetailsWithoutCover);
          motorError = retryResult.error;
          warnings.push(
            "Policy saved, but Type of Cover was not saved because the Supabase update SQL has not been run.",
          );
        }
        if (motorError) throw motorError;
      }
    } else if (isFireLikeInsurance(insuranceCode)) {
      const propertyAddress = optionalText(formData, "property_address");
      const { error: fireError } = await supabase
        .from("fire_policy_details")
        .insert({
          policy_term_id: policyTerm.id,
          property_address: propertyAddress,
          risk_location: propertyAddress,
          occupation: optionalText(formData, "occupation"),
          construction_type: optionalText(formData, "construction_type"),
        });
      if (fireError) throw fireError;
    } else if (insuranceCode === "marine_insurance") {
      const { error: marineError } = await supabase
        .from("marine_policy_details")
        .insert({
          policy_term_id: policyTerm.id,
          marine_type: optionalText(formData, "marine_type"),
          voyage_from: optionalText(formData, "voyage_from"),
          voyage_to: optionalText(formData, "voyage_to"),
          goods_description: optionalText(formData, "goods_description"),
        });
      if (marineError) throw marineError;
    } else if (isEquipmentPolicy) {
      const detailsJson = {
        vehicle_no: equipmentVehicleNo ? equipmentVehicleNo.toUpperCase() : null,
        make_model: optionalText(formData, "equipment_make_model"),
        year: optionalText(formData, "equipment_year"),
        engine_no: optionalText(formData, "equipment_engine_no"),
        chassis_no: optionalText(formData, "equipment_chassis_no"),
      };
      const { error: equipmentError } = await supabase
        .from("generic_policy_details")
        .insert({
          policy_term_id: policyTerm.id,
          detail_type: insuranceType.name ?? "Equipment Insurance",
          description: optionalText(formData, "generic_description") || resolvedRiskLabel,
          details_json: detailsJson,
        });
      if (equipmentError) throw equipmentError;
    } else if (insuranceCode === "travel") {
      const { error: travelError } = await supabase
        .from("travel_policy_details")
        .insert({
          policy_term_id: policyTerm.id,
          destination: optionalText(formData, "destination"),
          pax: integerValue(formData, "pax"),
          plan_name: optionalText(formData, "plan_name"),
        });
      if (travelError) throw travelError;
    } else {
      const { error: genericError } = await supabase
        .from("generic_policy_details")
        .insert({
          policy_term_id: policyTerm.id,
          detail_type: optionalText(formData, "generic_detail_type"),
          description: optionalText(formData, "generic_description") || resolvedRiskLabel,
        });
      if (genericError) throw genericError;
    }

    if (splitPatternId && grossPremium !== null && netCommissionPercent !== null) {
      try {
        const { data: rules, error: rulesError } = await supabase
          .from("commission_split_rules")
          .select("payee_id, rule_type, share_percent, fixed_percent, subtract_percent")
          .eq("split_pattern_id", splitPatternId)
          .order("sort_order", { ascending: true });
        if (rulesError) throw rulesError;

        const splitRules = (rules ?? []) as SplitRule[];
        if (!splitRules.length) {
          throw new Error("Selected split pattern has no commission rules.");
        }
        const hasNetPremiumFixedRule = splitRules.some(
          (rule) => rule.rule_type === "fixed_percent_of_gross",
        );
        if (hasNetPremiumFixedRule && netPremium === null) {
          throw new Error("Net premium is required for this split pattern.");
        }
        const equalRuleCount =
          splitRules.filter((rule) => rule.rule_type === "equal_net_share").length || 1;
        const netPercent = percentNumber(netCommissionPercent);
        const totalNetCommissionAmount = grossPremium * netPercent;
        const fixedNetPremiumAmount = splitRules
          .filter((rule) => rule.rule_type === "fixed_percent_of_gross")
          .reduce(
            (total, rule) =>
              total + (netPremium ?? 0) * percentNumber(rule.fixed_percent),
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
            policy_term_id: policyTerm.id,
            payee_id: rule.payee_id,
            split_pattern_id: splitPatternId,
            calculation_percent: calculationPercent,
            amount: roundedAmount,
            unpaid_amount: roundedAmount,
            status: "unpaid",
          };
        });

        if (commissions.length) {
          const { error: commissionError } = await supabase
            .from("commissions")
            .insert(commissions);
          if (commissionError) throw commissionError;
        }
      } catch (commissionError) {
        warnings.push(
          `Policy saved, but commission rows were not created: ${
            commissionError instanceof Error ? commissionError.message : "commission error"
          }`,
        );
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

    return {
      success: "Policy saved.",
      warning: warnings.length ? warnings.join(" ") : undefined,
    };
  } catch (error) {
    if (createdPolicyTermId) {
      await supabase.from("policy_terms").delete().eq("id", createdPolicyTermId);
    }

    if (createdPolicySeriesId) {
      await supabase.from("policy_series").delete().eq("id", createdPolicySeriesId);
    }

    if (createdClientId) {
      await supabase.from("clients").delete().eq("id", createdClientId);
    }

    return {
      error: readableError(error, "Policy could not be saved."),
    };
  }
}
