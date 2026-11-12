export function normalizeMoneyText(value: string) {
  const cleaned = value.replace(/rm/gi, "").replace(/[^\d.]/g, "");
  const [whole = "", ...decimalParts] = cleaned.split(".");
  const decimal = decimalParts.join("").slice(0, 2);
  return decimalParts.length ? `${whole}.${decimal}` : whole;
}

export function formatMoneyText(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  const normalized = normalizeMoneyText(String(value));
  if (!normalized) return "";
  const [whole, decimal] = normalized.split(".");
  const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${formattedWhole}.${(decimal ?? "").padEnd(2, "0")}`;
}
