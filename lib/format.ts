export function formatPercent(value: number | string | null | undefined) {
  const amount = Number(String(value ?? 0).replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount === 0) return "-";

  return `${new Intl.NumberFormat("en-MY", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount * 100)}%`;
}
