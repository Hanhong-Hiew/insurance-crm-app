export function signedCommissionAmount(raw: string) {
  const value = raw.trim().replace(/^RM\s*/i, "").replace(/,/g, "");
  if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("Enter an RM amount with at most 2 decimal places. Use minus for a clawback.");
  const amount = Number(value);
  if (!Number.isFinite(amount) || Math.abs(amount) >= 1e12) throw new Error("Amount is outside the supported range.");
  return amount;
}

export function payableCommission(row: {entry_kind?: string | null; unpaid_amount: number | string | null; amount: number | string | null}) {
  return Number(row.entry_kind === "adjustment" ? row.amount ?? 0 : row.unpaid_amount ?? row.amount ?? 0);
}
