"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { accuracyDate } from "@/lib/policy-accuracy-server";
import { nullableNumber } from "@/lib/policy-accuracy";

export type EndorsementState = { error?: string; success?: string; resultId?: string };

export async function findMotorTransferCandidates(plate: string, policyTermId?: string) {
  const supabase = await createClient();
  const { data: user, error: authError } = await supabase.auth.getClaims();
  if (authError || !user?.claims) return { error: "You must be logged in.", rows: [] };
  if (!plate.trim()) return { error: "Enter the vehicle number first.", rows: [] };
  const { data, error } = await supabase.rpc("kover_motor_transfer_candidates", { p_plate: plate, p_term_id: policyTermId ?? null });
  return { error: error?.message, rows: (data ?? []) as Array<{id:string;client_name:string;policy_number:string|null;effective_date:string|null}> };
}

export async function saveEndorsement(_previous: EndorsementState, data: FormData): Promise<EndorsementState> {
  try {
    const text = (key: string) => String(data.get(key) ?? "").trim();
    const signedMoney = (key: string, required = false) => {
      const raw = text(key);
      if (!raw && !required) return null;
      const amount = nullableNumber(raw);
      if (amount === null) throw new Error(`${key.replaceAll("_"," ")} must be a valid amount. Use a minus sign for a refund.`);
      return Math.round(amount * 100) / 100;
    };
    const termId = text("policy_term_id");
    const supabase = await createClient();
    const { data: user, error: authError } = await supabase.auth.getClaims();
    if (authError || !user?.claims) throw new Error("You must be logged in.");
    const { error } = await supabase.rpc("kover_save_endorsement", {
      p_term_id: termId, p_endorsement_id: text("endorsement_id") || null,
      p_values: {
        endorsement_number: text("endorsement_number") || null,
        issue_date: accuracyDate(text("issue_date")), effective_date: accuracyDate(text("effective_date")),
        description: text("description"), premium_change: signedMoney("premium_change",true),
        service_tax_change: signedMoney("service_tax_change"), net_amount: signedMoney("net_amount"),
        settlement_status: text("settlement_status") || "pending",
      }, p_commission_decision: text("commission_decision") || null,
    });
    if (error) throw error;
    revalidatePath("/protected");
    revalidatePath("/protected/records");
    revalidatePath("/protected/commission-payments");
    revalidatePath(`/protected/policies/${termId}`);
    revalidatePath(`/protected/policies/${termId}/edit`);
    return { success: "Endorsement saved. Current premiums updated.", resultId: crypto.randomUUID() };
  } catch (error) {
    const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : "Endorsement was not saved.";
    return { error: message, resultId: crypto.randomUUID() };
  }
}

