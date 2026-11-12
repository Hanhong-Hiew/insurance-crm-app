"use client";

import { CalendarDays } from "lucide-react";
import { useRef, useState } from "react";

export function PolicyDateInput({ name, defaultValue, required = false }: {
  name: string; defaultValue?: string | null; required?: boolean;
}) {
  const display = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.split("-").reverse().join("/") : value;
  const [value, setValue] = useState(display(defaultValue ?? ""));
  const picker = useRef<HTMLInputElement>(null);
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = match ? `${match[3]}-${match[2].padStart(2,"0")}-${match[1].padStart(2,"0")}` : "";
  return <div className="relative flex h-10 rounded-lg border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-sky-100">
    <input aria-label={name.replaceAll("_", " ")} className="min-w-0 flex-1 rounded-l-lg bg-white px-3 text-sm text-slate-700 outline-none"
      name={name} value={value} required={required} placeholder="dd/mm/yyyy" inputMode="numeric"
      onChange={event => setValue(event.target.value)}
      onBlur={() => {
        const parsed = value.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
        if (parsed) setValue(`${parsed[1].padStart(2,"0")}/${parsed[2].padStart(2,"0")}/${parsed[3].length === 2 ? (Number(parsed[3]) >= 70 ? "19" : "20") + parsed[3] : parsed[3]}`);
      }} />
    <button type="button" title="Open calendar" aria-label="Open calendar" className="relative w-10 shrink-0 rounded-r-lg border-l border-sky-100 bg-sky-50 text-sky-700"
      onClick={() => picker.current?.showPicker?.()}>
      <CalendarDays className="mx-auto h-4 w-4" />
    </button>
      <input aria-hidden="true" tabIndex={-1} className="pointer-events-none absolute right-0 h-px w-px opacity-0" ref={picker} type="date" value={iso}
        onChange={event => setValue(display(event.target.value))} />
  </div>;
}
