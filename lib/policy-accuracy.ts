import { roundMoney } from "./commission";

export type PremiumBreakdown = {
  basic_premium?: number | string | null;
  ncd_amount?: number | string | null;
  service_tax?: number | string | null;
  stamp_duty?: number | string | null;
  total_payable_override?: boolean | null;
  typical_premium_rate?: number | string | null;
  cover_note_number?: string | null;
  issue_date?: string | null;
  financial_interest?: string | null;
  seating_capacity?: number | string | null;
  product_name?: string | null;
  original_gross_premium?: number | string | null;
  original_total_premium?: number | string | null;
  cancellation_date?: string | null;
  refund_amount?: number | string | null;
  gross_refund_amount?: number | string | null;
  transferred_from_policy_term_id?: string | null;
};

export function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/rm|,|\s|%/gi, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function totalPayable(gross: unknown, serviceTax: unknown, stampDuty: unknown) {
  const value = nullableNumber(gross);
  return value === null ? null : roundMoney(value + (nullableNumber(serviceTax) ?? 0) + (nullableNumber(stampDuty) ?? 0));
}

export function premiumWarnings(input: {
  gross: unknown; total: unknown; serviceTax: unknown; stampDuty: unknown;
  sumInsured: unknown; typicalRatePercent: unknown;
}) {
  const warnings: string[] = [];
  const gross = nullableNumber(input.gross);
  const total = nullableNumber(input.total);
  const expected = totalPayable(input.gross, input.serviceTax, input.stampDuty);
  const sum = nullableNumber(input.sumInsured);
  const rate = nullableNumber(input.typicalRatePercent);
  if (gross !== null && sum !== null && rate !== null && rate > 0 && gross < 0.2 * sum * rate / 100) {
    warnings.push("Gross Premium is below 20% of Sum Insured × typical rate. Check for a missing digit.");
  }
  if (total !== null && expected !== null && Math.abs(roundMoney(total - expected)) > 1) {
    warnings.push(`Total Payable differs from Gross + Service Tax + Stamp Duty by RM ${Math.abs(total - expected).toFixed(2)}.`);
  }
  return warnings;
}

export function normalizePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
