const numericFields = new Set([
  "primary_sum_assured", "gross_premium", "total_premium", "bdm", "btm",
  "engine_cc", "year_of_manufacture", "pax", "custom_commission_amount",
  "custom_commission_percent", "custom_total_commission_amount",
]);

function normalizedField(key: string, value: string) {
  const text = value.trim();
  if (numericFields.has(key) || key === "ncd") {
    const cleaned = text.replace(/rm|,|\s|%/gi, "");
    if (!cleaned) return "";
    const number = Number(cleaned);
    if (!Number.isFinite(number)) return text;
    return String(key === "ncd" && number > 1 ? number / 100 : number);
  }
  if (key === "effective_date" || key === "expiry_date") {
    const match = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
    if (match) {
      const year = match[3].length === 2
        ? (Number(match[3]) >= 70 ? "19" : "20") + match[3] : match[3];
      return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    }
  }
  if (key === "vehicle_no" || key === "equipment_vehicle_no") return text.toUpperCase();
  return text;
}

export function snapshotPolicyForm(data: FormData): Record<string, string[]> {
  const snapshot: Record<string, string[]> = {};
  data.forEach((value, key) => {
    if (typeof value !== "string" || key.startsWith("$") || key.startsWith("_")) return;
    (snapshot[key] ??= []).push(normalizedField(key, value));
  });
  return snapshot;
}

export function changedPolicyFields(
  before: Record<string, string[]>, after: Record<string, string[]>,
) {
  // Removed risk-section inputs do not mean “clear the old risk's fields”.
  return Object.keys(after).filter((key) =>
    key !== "policy_term_id" && JSON.stringify(before[key] ?? []) !== JSON.stringify(after[key]),
  );
}

export function differentPolicyValues(before: unknown, after: unknown): boolean {
  if (typeof after === "number") {
    if (before === null || before === undefined || before === "") return true;
    return Number(before) !== after;
  }
  if (after === null) return before !== null && before !== undefined && before !== "";
  if (after && typeof after === "object") {
    if (!before || typeof before !== "object") return true;
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys].some((key) => differentPolicyValues(
      (before as Record<string, unknown>)[key], (after as Record<string, unknown>)[key],
    ));
  }
  return before !== after;
}

export function changedPolicyValues(
  before: Record<string, unknown> | null | undefined, after: Record<string, unknown>,
) {
  return Object.fromEntries(Object.entries(after).filter(([key, value]) =>
    differentPolicyValues(before?.[key], value),
  ));
}
