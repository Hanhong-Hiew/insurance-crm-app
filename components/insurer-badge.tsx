"use client";

type InsurerBadgeProps = {
  name: string | null | undefined;
  wrap?: boolean;
};

function clean(value: string | null | undefined) {
  if (!value) return "-";
  return value;
}

function colorClass(name: string | null | undefined) {
  const normalized = String(name ?? "").toLowerCase();

  if (normalized.includes("great eastern")) {
    return "border-red-200 bg-red-100 text-red-800";
  }
  if (normalized.includes("etiqa takaful")) {
    return "border-yellow-200 bg-yellow-100 text-yellow-900";
  }
  if (normalized.includes("etiqa general")) {
    return "border-orange-200 bg-orange-100 text-orange-800";
  }
  if (normalized.includes("qbe")) {
    return "border-purple-200 bg-purple-100 text-purple-800";
  }
  if (normalized.includes("tokio")) {
    return "border-emerald-200 bg-emerald-100 text-emerald-800";
  }
  if (normalized.includes("progressive")) {
    return "border-pink-200 bg-pink-100 text-pink-800";
  }
  if (normalized.includes("allianz")) {
    return "border-sky-200 bg-sky-100 text-sky-800";
  }

  return "border-slate-200 bg-slate-100 text-slate-800";
}

export function InsurerBadge({ name, wrap = false }: InsurerBadgeProps) {
  return (
    <span
      className={`inline-flex max-w-36 items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${colorClass(name)}`}
      title={clean(name)}
    >
      <span className={wrap ? "whitespace-normal break-words leading-tight" : "truncate"}>
        {clean(name)}
      </span>
    </span>
  );
}
