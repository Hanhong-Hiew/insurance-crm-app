"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type CommissionPaymentState = {
  error?: string;
  success?: string;
};

type CommissionPaymentRow = {
  amount: number | string | null;
  calculation_percent: number | string | null;
  commission_payees: { id?: string | null; name?: string | null } | Array<{ id?: string | null; name?: string | null }> | null;
  id: string;
  payee_id: string;
  policy_terms: {
    effective_date?: string | null;
    expiry_date?: string | null;
    gross_premium?: number | string | null;
    premium_status?: string | null;
    policy_number?: string | null;
    clients?: { client_name?: string | null } | Array<{ client_name?: string | null }> | null;
    insurers?: { insurer_name?: string | null } | Array<{ insurer_name?: string | null }> | null;
    insurance_types?: { name?: string | null } | Array<{ name?: string | null }> | null;
  } | null;
  unpaid_amount: number | string | null;
};

function firstValue<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function moneyNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function nextStatementNo(supabase: Awaited<ReturnType<typeof createClient>>) {
  const year = new Date().getFullYear();
  const prefix = `COMM-${year}-`;
  const { count, error } = await supabase
    .from("commission_payment_batches")
    .select("id", { count: "exact", head: true })
    .gte("statement_no", `${prefix}0000`)
    .lte("statement_no", `${prefix}9999`);
  if (error) throw error;
  return `${prefix}${String((count ?? 0) + 1).padStart(4, "0")}`;
}

export async function confirmCommissionPayment(
  _previousState: CommissionPaymentState,
  formData: FormData,
): Promise<CommissionPaymentState> {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getClaims();
    if (userError || !userData?.claims) {
      return { error: "You must be logged in." };
    }

    const paidDate = textValue(formData, "paid_date");
    const notes = textValue(formData, "notes") || null;
    const selectedIds = formData
      .getAll("commission_id")
      .map((value) => (typeof value === "string" ? value : ""))
      .filter(Boolean);

    if (!paidDate) return { error: "Paid date is required." };
    if (!selectedIds.length) return { error: "Select at least one commission." };

    const { data, error } = await supabase
      .from("commissions")
      .select(
        "id, payee_id, calculation_percent, amount, unpaid_amount, commission_payees(id, name), policy_terms!inner(policy_number, effective_date, expiry_date, gross_premium, premium_status, clients(client_name), insurers(insurer_name), insurance_types(name))",
      )
      .in("id", selectedIds)
      .eq("policy_terms.premium_status", "paid")
      .neq("status", "paid");
    if (error) throw error;

    const rows = (data ?? []) as CommissionPaymentRow[];
    if (!rows.length) return { error: "Selected commissions are already paid or unavailable." };
    if (rows.length !== selectedIds.length) {
      return {
        error:
          "Some selected commissions are unavailable, already paid, or linked to unpaid premiums.",
      };
    }

    const groups = new Map<string, CommissionPaymentRow[]>();
    for (const row of rows) {
      groups.set(row.payee_id, [...(groups.get(row.payee_id) ?? []), row]);
    }

    for (const [payeeId, groupRows] of groups) {
      const totalAmount = groupRows.reduce(
        (sum, row) => sum + moneyNumber(row.unpaid_amount || row.amount),
        0,
      );
      const { data: batch, error: batchError } = await supabase
        .from("commission_payment_batches")
        .insert({
          notes,
          paid_date: paidDate,
          payee_id: payeeId,
          statement_date: new Date().toISOString().slice(0, 10),
          statement_no: await nextStatementNo(supabase),
          status: "paid",
          total_amount: totalAmount,
        })
        .select("id")
        .single();
      if (batchError) throw batchError;

      const items = groupRows.map((row) => {
        const term = row.policy_terms;
        const client = firstValue(term?.clients);
        const insurer = firstValue(term?.insurers);
        const insuranceType = firstValue(term?.insurance_types);
        return {
          amount_payable: moneyNumber(row.unpaid_amount || row.amount),
          batch_id: batch.id,
          client_name_snapshot: client?.client_name ?? null,
          commission_id: row.id,
          commission_percent_snapshot: row.calculation_percent,
          effective_date_snapshot: term?.effective_date ?? null,
          expiry_date_snapshot: term?.expiry_date ?? null,
          gross_premium_snapshot: term?.gross_premium ?? null,
          insurer_name_snapshot: insurer?.insurer_name ?? null,
          insurance_type_snapshot: insuranceType?.name ?? null,
          policy_number_snapshot: term?.policy_number ?? null,
        };
      });

      const { error: itemError } = await supabase
        .from("commission_payment_items")
        .insert(items);
      if (itemError) throw itemError;

      const { error: updateError } = await supabase
        .from("commissions")
        .update({
          paid_date: paidDate,
          payment_batch_id: batch.id,
          status: "paid",
          unpaid_amount: 0,
        })
        .in("id", groupRows.map((row) => row.id));
      if (updateError) throw updateError;
    }

    revalidatePath("/protected");
    revalidatePath("/protected/commission-payments");
    revalidatePath("/protected/records");
    return { success: `Marked ${rows.length} commission rows as paid.` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Commission payment was not saved.",
    };
  }
}
