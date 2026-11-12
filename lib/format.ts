export function formatPercent(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  const amount = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(amount)) return "-";

  return `${new Intl.NumberFormat("en-MY", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount * 100)}%`;
}
