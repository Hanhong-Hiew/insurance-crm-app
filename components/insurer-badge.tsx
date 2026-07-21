"use client";

type InsurerBadgeProps = {
  name: string | null | undefined;
};

function clean(value: string | null | undefined) {
  if (!value) return "-";
  return value;
}

function colorClass(name: string | null | undefined) {
  const normalized = String(name ?? "").toLowerCase();

  if (normalized.includes("great eastern")) {
    return "border-red-100 bg-red-50 text-red-700";
  }
  if (normalized.includes("etiqa takaful")) {
    return "border-yellow-100 bg-yellow-50 text-yellow-800";
  }
  if (normalized.includes("etiqa general")) {
    return "border-orange-100 bg-orange-50 text-orange-700";
  }
  if (normalized.includes("qbe")) {
    return "border-purple-100 bg-purple-50 text-purple-700";
  }
  if (normalized.includes("tokio")) {
    return "border-emerald-100 bg-emerald-50 text-emerald-700";
  }
  if (normalized.includes("progressive")) {
    return "border-pink-100 bg-pink-50 text-pink-700";
  }
  if (normalized.includes("allianz")) {
    return "border-sky-100 bg-sky-50 text-sky-700";
  }

  return "border-slate-100 bg-slate-50 text-slate-700";
}

export function InsurerBadge({ name }: InsurerBadgeProps) {
  return (
    <span
      className={`inline-flex max-w-36 items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${colorClass(name)}`}
      title={clean(name)}
    >
      <span className="truncate">{clean(name)}</span>
    </span>
  );
}
