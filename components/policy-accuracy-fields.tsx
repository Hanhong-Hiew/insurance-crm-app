"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { CurrencyInput } from "@/components/currency-input";
import { PolicyDateInput } from "@/components/policy-date-input";
import { nullableNumber, premiumWarnings, totalPayable, type PremiumBreakdown } from "@/lib/policy-accuracy";

const inputClass = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

export function PremiumBreakdownFields({ gross, total, onGrossChange, onTotalChange, sumInsured, initial, ncd, motor, typicalRate, required = false }: {
  gross: string; total: string; onGrossChange: (value: string) => void; onTotalChange: (value: string) => void;
  sumInsured: string; required?: boolean; initial?: PremiumBreakdown & { total_premium?: number | string | null };
  ncd?: number | string | null; motor?: boolean; typicalRate?: number | string | null;
}) {
  const [serviceTax, setServiceTax] = useState(String(initial?.service_tax ?? ""));
  const [stampDuty, setStampDuty] = useState(String(initial?.stamp_duty ?? ""));
  const [override, setOverride] = useState(initial?.total_payable_override ?? (initial?.total_premium != null));
  const [rate, setRate] = useState(String(initial?.typical_premium_rate != null ? Number(initial.typical_premium_rate) * 100 : typicalRate != null ? Number(typicalRate) * 100 : ""));
  const calculated = totalPayable(gross, serviceTax, stampDuty);
  useEffect(() => {
    if (!override) onTotalChange(calculated === null ? "" : calculated.toFixed(2));
  }, [calculated, override, onTotalChange]);
  const warnings = premiumWarnings({ gross, total, serviceTax, stampDuty, sumInsured, typicalRatePercent: rate });
  return <>
    <Field label="Basic Premium"><CurrencyInput defaultValue={initial?.basic_premium} name="basic_premium" /></Field>
    {motor && <Field label="NCD %"><input className={inputClass} name="ncd" inputMode="decimal" defaultValue={ncd == null || ncd === "" ? "" : String(Number(ncd) * 100)} placeholder="0" min="0" max="100" step="0.01" type="number" /></Field>}
    <Field label="NCD Amount"><CurrencyInput defaultValue={initial?.ncd_amount} name="ncd_amount" /></Field>
    <Field label="Gross Premium" required={required}><CurrencyInput required={required} name="gross_premium" value={gross} onValueChange={onGrossChange} /></Field>
    <Field label="Service Tax"><CurrencyInput name="service_tax" value={serviceTax} onValueChange={setServiceTax} /></Field>
    <Field label="Stamp Duty"><CurrencyInput name="stamp_duty" value={stampDuty} onValueChange={setStampDuty} /></Field>
    <div className="min-w-0"><label htmlFor="total_premium" className="mb-2 block text-sm font-medium text-slate-700">Total Payable</label>
      {override ? <CurrencyInput name="total_premium" value={total} onValueChange={onTotalChange} /> :
        <><input name="total_premium" type="hidden" value={calculated ?? ""} /><output id="total_premium" className={inputClass + " flex items-center bg-slate-50 font-semibold"}>{calculated === null ? "—" : `RM ${calculated.toLocaleString("en-MY",{minimumFractionDigits:2,maximumFractionDigits:2})}`}</output></>}
      <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={override} onChange={event => setOverride(event.target.checked)} /> Override total (insurer rounding)
      </label>
      <input type="hidden" name="total_payable_override" value={override ? "yes" : "no"} />
    </div>
    <Field label="Typical premium rate %">
      <input className={inputClass} name="typical_premium_rate" inputMode="decimal" type="number" min="0" max="100" step="0.0001"
        value={rate} onChange={event => setRate(event.target.value)} placeholder="Optional risk benchmark" />
      {nullableNumber(rate) === null && <p className="mt-1 text-xs text-slate-500">Set a benchmark to detect unusually low premiums.</p>}
    </Field>
    {warnings.length > 0 && <div role="alert" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 md:col-span-2 xl:col-span-3">
      {warnings.map(warning => <p className="flex gap-2" key={warning}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{warning}</p>)}
    </div>}
  </>;
}

export function PolicyExtraFields({ initial, motor }: { initial?: PremiumBreakdown; motor?: boolean }) {
  return <>
    <Field label="Cover Note No."><input className={inputClass} name="cover_note_number" defaultValue={initial?.cover_note_number ?? ""} /></Field>
    <Field label="Date of Issue"><PolicyDateInput name="issue_date" defaultValue={initial?.issue_date} /></Field>
    <Field label="Product / Plan Name"><input className={inputClass} name="product_name" defaultValue={initial?.product_name ?? ""} /></Field>
    <Field label="Hire Purchase / Financial Interest"><input className={inputClass} name="financial_interest" defaultValue={initial?.financial_interest ?? ""} placeholder="Bank / financier name" /></Field>
    {motor && <Field label="Seating Capacity"><input className={inputClass} name="seating_capacity" type="number" min="0" step="1" defaultValue={initial?.seating_capacity ?? ""} /></Field>}
  </>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block min-w-0"><span className="mb-2 block text-sm font-medium text-slate-700">{label}{required && <span className="ml-1 text-red-600">*</span>}</span>{children}</label>;
}
