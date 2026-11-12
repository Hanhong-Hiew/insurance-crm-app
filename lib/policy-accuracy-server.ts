import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nullableNumber, premiumWarnings, totalPayable, normalizePlate } from "@/lib/policy-accuracy";

function text(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}

export function accuracyMoney(data: FormData, key: string) {
  const raw = text(data, key);
  if (!raw) return null;
  const value = nullableNumber(raw);
  if (value === null || value < 0) throw new Error(`${key.replaceAll("_", " ")} must be zero or a positive amount.`);
  return Math.round(value * 100) / 100;
}

export function accuracyDate(raw: string) {
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
  if (!match) throw new Error("Date must use dd/mm/yyyy.");
  const year = match[3].length === 2 ? Number(match[3]) + (Number(match[3]) >= 70 ? 1900 : 2000) : Number(match[3]);
  const date = new Date(Date.UTC(year, Number(match[2]) - 1, Number(match[1])));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== Number(match[2])-1 || date.getUTCDate() !== Number(match[1])) throw new Error("Invalid date. Use dd/mm/yyyy.");
  return date.toISOString().slice(0,10);
}

export function readPolicyAccuracy(data: FormData) {
  const rateText = text(data, "typical_premium_rate");
  const rate = rateText ? nullableNumber(rateText) : null;
  if (rateText && (rate === null || rate < 0 || rate > 100)) throw new Error("Typical premium rate must be between 0 and 100%.");
  const seatsText = text(data, "seating_capacity");
  const seats = seatsText ? Number(seatsText) : null;
  if (seats !== null && (!Number.isInteger(seats) || seats < 0)) throw new Error("Seating capacity must be zero or a positive whole number.");
  return {
    basic_premium: accuracyMoney(data, "basic_premium"), ncd_amount: accuracyMoney(data, "ncd_amount"),
    service_tax: accuracyMoney(data, "service_tax"), stamp_duty: accuracyMoney(data, "stamp_duty"),
    total_payable_override: text(data, "total_payable_override") === "yes",
    typical_premium_rate: rate === null ? null : rate / 100,
    cover_note_number: text(data, "cover_note_number") || null, issue_date: accuracyDate(text(data, "issue_date")),
    financial_interest: text(data, "financial_interest") || null, seating_capacity: seats,
    product_name: text(data, "product_name") || null,
    transferred_from_policy_term_id: text(data, "transferred_from_policy_term_id") || null,
    cancellation_date: accuracyDate(text(data, "cancellation_date")),
    refund_amount: accuracyMoney(data, "refund_amount"), gross_refund_amount: accuracyMoney(data, "gross_refund_amount"),
  };
}

export async function checkPolicyAccuracy(supabase: SupabaseClient, data: FormData, input: {
  id?: string; gross: number | null; total: number | null; sumInsured: number | null;
  start: string | null; end: string | null; motor: boolean;
}, accuracy: ReturnType<typeof readPolicyAccuracy>) {
  const warnings = premiumWarnings({
    gross: input.gross, total: input.total, serviceTax: accuracy.service_tax, stampDuty: accuracy.stamp_duty,
    sumInsured: input.sumInsured, typicalRatePercent: accuracy.typical_premium_rate === null ? null : accuracy.typical_premium_rate * 100,
  });
  const { data: duplicates, error } = await supabase.rpc("kover_policy_duplicate_warnings", {
    p_term_id: input.id ?? null, p_plate: input.motor ? text(data,"vehicle_no") : null,
    p_start: input.start, p_end: input.end, p_policy_number: text(data,"policy_number") || null,
    p_cover_note: accuracy.cover_note_number,
  });
  if (error) throw error;
  for (const row of duplicates ?? []) warnings.push(`${row.reason}: ${row.client_name} (${row.policy_number || row.cover_note_number || row.policy_term_id}).`);
  if (accuracy.transferred_from_policy_term_id) {
    if (!input.motor || accuracy.transferred_from_policy_term_id === input.id) throw new Error("Transfer must link to a previous motor policy.");
    const { data: previous, error: lookupError } = await supabase.from("motor_policy_details")
      .select("vehicle_no_snapshot, vehicles(vehicle_no)").eq("policy_term_id",accuracy.transferred_from_policy_term_id).maybeSingle();
    if (lookupError) throw lookupError;
    const vehicle = Array.isArray(previous?.vehicles) ? previous.vehicles[0] : previous?.vehicles;
    const { data: previousTerm, error: previousTermError } = await supabase.from("policy_terms").select("effective_date").eq("id",accuracy.transferred_from_policy_term_id).single();
    if (previousTermError) throw previousTermError;
    if (input.start && previousTerm.effective_date && previousTerm.effective_date > input.start) throw new Error("Transferred-from policy must not start after this policy.");
    if (!previous || normalizePlate(previous.vehicle_no_snapshot || vehicle?.vehicle_no || "") !== normalizePlate(text(data,"vehicle_no"))) throw new Error("Transferred-from policy must have the same vehicle plate.");
  }
  if (!warnings.length) return null;
  const token = createHash("sha256").update(JSON.stringify({ input, accuracy, warnings, policy: text(data,"policy_number"), plate: text(data,"vehicle_no") })).digest("hex");
  if (text(data,"_acknowledge_warnings") === "yes" && text(data,"_warning_token") === token) return null;
  return { warning: warnings.join("\n"), warningToken: token, needsAcknowledgement: true, resultId: crypto.randomUUID() };
}

export function resolvedTotal(data: FormData, gross: number | null, accuracy: ReturnType<typeof readPolicyAccuracy>) {
  return accuracy.total_payable_override ? accuracyMoney(data,"total_premium") : totalPayable(gross,accuracy.service_tax,accuracy.stamp_duty);
}
