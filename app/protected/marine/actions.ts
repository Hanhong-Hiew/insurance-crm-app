"use server";

import { revalidatePath } from "next/cache";

import {
  calculateCommissionRows,
  type CommissionRule,
  toNumber,
} from "@/lib/commission";
import { createClient } from "@/lib/supabase/server";

export type MarineActionState = {
  error?: string;
  resultId?: number;
  success?: string;
};

type SplitRuleRow = Omit<CommissionRule, "payee_name"> & {
  commission_payees?:
    | { name?: string | null }
    | Array<{ name?: string | null }>
    | null;
};

function firstValue<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value || null;
}

function moneyValue(formData: FormData, key: string) {
  const raw = textValue(formData, key).replace(/rm/gi, "").replace(/,/g, "");
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${key.replaceAll("_", " ")} must be a valid amount.`);
  }
  return Math.round(value * 100) / 100;
}

function requiredDate(formData: FormData, key: string) {
  const value = textValue(formData, key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${key.replaceAll("_", " ")} is required.`);
  }
  return value;
}

function monthStart(value: string) {
  const source = value.length === 7 ? `${value}-01` : value;
  const parsed = new Date(`${source}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Billing month is invalid.");
  }
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-01`;
}

function readableError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    if (parts.length) return parts.join(" ");
  }
  return fallback;
}

async function requireSupabase() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) throw new Error("You must be logged in.");
  return supabase;
}

async function finishMarineAction(
  operation: () => Promise<string>,
  fallback: string,
): Promise<MarineActionState> {
  try {
    const success = await operation();
    revalidatePath("/protected");
    revalidatePath("/protected/marine");
    return { resultId: Date.now(), success };
  } catch (error) {
    return {
      error: readableError(error, fallback),
      resultId: Date.now(),
    };
  }
}

export async function registerMarineOpenCover(
  _previousState: MarineActionState,
  formData: FormData,
): Promise<MarineActionState> {
  return finishMarineAction(async () => {
    const supabase = await requireSupabase();
    const policyTermId = textValue(formData, "policy_term_id");
    if (!policyTermId) throw new Error("Choose a marine policy to register.");

    const { error } = await supabase.from("marine_open_covers").upsert(
      {
        notes: optionalText(formData, "notes"),
        policy_term_id: policyTermId,
        status: "active",
      },
      { onConflict: "policy_term_id" },
    );
    if (error) throw error;
    return "Marine open cover registered.";
  }, "Marine open cover could not be registered.");
}

export async function saveMarineDeclaration(
  _previousState: MarineActionState,
  formData: FormData,
): Promise<MarineActionState> {
  return finishMarineAction(async () => {
    const supabase = await requireSupabase();
    const openCoverId = textValue(formData, "open_cover_id");
    const declarationDate = requiredDate(formData, "declaration_date");
    const grossPremium = moneyValue(formData, "gross_premium");
    const totalPremium = moneyValue(formData, "total_premium") ?? grossPremium;
    if (!openCoverId) throw new Error("Choose an open cover.");
    if (grossPremium === null) throw new Error("Gross premium is required.");
    if (totalPremium === null) throw new Error("Total premium is required.");

    const { error } = await supabase.from("marine_declarations").insert({
      billing_month: monthStart(declarationDate),
      certificate_no: optionalText(formData, "certificate_no"),
      declaration_date: declarationDate,
      goods_description: optionalText(formData, "goods_description"),
      gross_premium: grossPremium,
      notes: optionalText(formData, "notes"),
      open_cover_id: openCoverId,
      sum_insured: moneyValue(formData, "sum_insured"),
      total_premium: totalPremium,
      vessel: optionalText(formData, "vessel"),
    });
    if (error) throw error;
    return "Marine declaration saved.";
  }, "Marine declaration could not be saved.");
}

export async function createMarineMonthlyBill(
  _previousState: MarineActionState,
  formData: FormData,
): Promise<MarineActionState> {
  return finishMarineAction(async () => {
    const supabase = await requireSupabase();
    const openCoverId = textValue(formData, "open_cover_id");
    const billingMonth = monthStart(textValue(formData, "billing_month"));
    if (!openCoverId) throw new Error("Choose an open cover.");

    const { data: declarations, error: declarationError } = await supabase
      .from("marine_declarations")
      .select("id, gross_premium, total_premium")
      .eq("open_cover_id", openCoverId)
      .eq("billing_month", billingMonth);
    if (declarationError) throw declarationError;
    if (!(declarations ?? []).length) {
      throw new Error("No declarations found for this month.");
    }

    const { data: openCover, error: openCoverError } = await supabase
      .from("marine_open_covers")
      .select("policy_term_id")
      .eq("id", openCoverId)
      .single();
    if (openCoverError) throw openCoverError;

    const grossTotal = (declarations ?? []).reduce(
      (sum, row) => sum + toNumber(row.gross_premium),
      0,
    );
    const totalPremium = (declarations ?? []).reduce(
      (sum, row) => sum + toNumber(row.total_premium),
      0,
    );

    const { data: existingBill, error: existingBillError } = await supabase
      .from("marine_monthly_billings")
      .select("id, payment_status, commission_status")
      .eq("open_cover_id", openCoverId)
      .eq("billing_month", billingMonth)
      .maybeSingle();
    if (existingBillError) throw existingBillError;
    if (existingBill?.payment_status === "paid") {
      throw new Error("This monthly bill is already paid. It cannot be refreshed.");
    }
    if (existingBill?.commission_status === "paid") {
      throw new Error("This monthly bill already has paid commission. It cannot be refreshed.");
    }

    const { data: bill, error: billError } = await supabase
      .from("marine_monthly_billings")
      .upsert(
        {
          billing_month: billingMonth,
          gross_premium_total: grossTotal,
          open_cover_id: openCoverId,
          total_premium_total: totalPremium,
        },
        { onConflict: "open_cover_id,billing_month" },
      )
      .select("id")
      .single();
    if (billError) throw billError;

    const { data: paidCommissionRows, error: paidLookupError } = await supabase
      .from("marine_billing_commissions")
      .select("id")
      .eq("billing_id", bill.id)
      .eq("status", "paid")
      .limit(1);
    if (paidLookupError) throw paidLookupError;
    if ((paidCommissionRows ?? []).length) {
      throw new Error("This bill already has paid commission rows. It cannot be refreshed.");
    }

    const { error: linkError } = await supabase
      .from("marine_declarations")
      .update({
        billing_status: "billed",
        monthly_billing_id: bill.id,
      })
      .eq("open_cover_id", openCoverId)
      .eq("billing_month", billingMonth);
    if (linkError) throw linkError;

    const { error: deleteCommissionError } = await supabase
      .from("marine_billing_commissions")
      .delete()
      .eq("billing_id", bill.id);
    if (deleteCommissionError) throw deleteCommissionError;

    const { data: term, error: termError } = await supabase
      .from("policy_terms")
      .select("split_pattern_id, gross_commission_percent, net_commission_percent")
      .eq("id", openCover.policy_term_id)
      .single();
    if (termError) throw termError;

    if (term?.split_pattern_id && grossTotal > 0) {
      const { data: rules, error: rulesError } = await supabase
        .from("commission_split_rules")
        .select(
          "payee_id, rule_type, share_percent, fixed_percent, subtract_percent, commission_payees(name)",
        )
        .eq("split_pattern_id", term.split_pattern_id)
        .order("sort_order", { ascending: true });
      if (rulesError) throw rulesError;

      const commissionRows = calculateCommissionRows({
        grossCommissionPercent: toNumber(term.gross_commission_percent),
        grossPremium: grossTotal,
        netCommissionPercent: toNumber(term.net_commission_percent),
        rules: ((rules ?? []) as SplitRuleRow[]).map((rule) => ({
          ...rule,
          payee_name: firstValue(rule.commission_payees)?.name ?? null,
        })),
      });

      if (commissionRows.length) {
        const { error: commissionError } = await supabase
          .from("marine_billing_commissions")
          .insert(
            commissionRows.map((row) => ({
              amount: row.amount,
              billing_id: bill.id,
              calculation_percent: row.calculation_percent,
              payee_id: row.payee_id,
              payee_name_snapshot: row.payee_name,
              status: "unpaid",
              unpaid_amount: row.amount,
            })),
          );
        if (commissionError) throw commissionError;
      }
    }

    return "Marine monthly bill created.";
  }, "Marine monthly bill could not be created.");
}

export async function setMarineBillingPaymentStatus(
  _previousState: MarineActionState,
  formData: FormData,
): Promise<MarineActionState> {
  return finishMarineAction(async () => {
    const supabase = await requireSupabase();
    const billingId = textValue(formData, "billing_id");
    const paymentStatus = textValue(formData, "payment_status");
    const paidDate = optionalText(formData, "paid_date");
    if (!billingId) throw new Error("Billing row is required.");
    if (!["unpaid", "partial", "paid"].includes(paymentStatus)) {
      throw new Error("Payment status is invalid.");
    }
    if (paymentStatus === "paid" && !paidDate) {
      throw new Error("Paid date is required when marking a bill paid.");
    }

    const { error } = await supabase
      .from("marine_monthly_billings")
      .update({
        paid_date: paymentStatus === "paid" ? paidDate : null,
        payment_status: paymentStatus,
      })
      .eq("id", billingId);
    if (error) throw error;

    const { error: declarationError } = await supabase
      .from("marine_declarations")
      .update({
        billing_status: paymentStatus === "paid" ? "paid" : "billed",
      })
      .eq("monthly_billing_id", billingId);
    if (declarationError) throw declarationError;

    return "Marine billing payment status updated.";
  }, "Marine billing payment status could not be updated.");
}

export async function setMarineCommissionStatus(
  _previousState: MarineActionState,
  formData: FormData,
): Promise<MarineActionState> {
  return finishMarineAction(async () => {
    const supabase = await requireSupabase();
    const billingId = textValue(formData, "billing_id");
    const commissionStatus = textValue(formData, "commission_status");
    const paidDate = optionalText(formData, "commission_paid_date");
    if (!billingId) throw new Error("Billing row is required.");
    if (!["unpaid", "paid"].includes(commissionStatus)) {
      throw new Error("Commission status is invalid.");
    }
    if (commissionStatus === "paid" && !paidDate) {
      throw new Error("Commission paid date is required.");
    }

    if (commissionStatus === "paid") {
      const { error } = await supabase
        .from("marine_billing_commissions")
        .update({
          paid_date: paidDate,
          status: "paid",
          unpaid_amount: 0,
        })
        .eq("billing_id", billingId);
      if (error) throw error;
    } else {
      const { data: rows, error: rowsError } = await supabase
        .from("marine_billing_commissions")
        .select("id, amount")
        .eq("billing_id", billingId);
      if (rowsError) throw rowsError;

      for (const row of rows ?? []) {
        const { error } = await supabase
            .from("marine_billing_commissions")
          .update({
            paid_date: null,
            status: "unpaid",
            unpaid_amount: row.amount,
          })
          .eq("id", row.id);
        if (error) throw error;
      }
    }

    const { error: billError } = await supabase
      .from("marine_monthly_billings")
      .update({
        commission_paid_date: commissionStatus === "paid" ? paidDate : null,
        commission_status: commissionStatus,
      })
      .eq("id", billingId);
    if (billError) throw billError;

    return "Marine commission status updated.";
  }, "Marine commission status could not be updated.");
}
