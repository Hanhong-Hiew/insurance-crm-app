"use client";

import { Pencil, Plus, Save, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { saveEndorsement, type EndorsementState } from "@/app/protected/policies/[id]/accuracy-actions";
import { PolicyDateInput } from "@/components/policy-date-input";
import { ActionMessage } from "@/components/action-message";
import { calculateCommissionRows, type CommissionRule } from "@/lib/commission";
import { nullableNumber } from "@/lib/policy-accuracy";

export type PolicyEndorsement = {
  id: string; endorsement_number: string | null; issue_date: string | null; effective_date: string | null;
  description: string | null; premium_change: number | string | null; service_tax_change: number | string | null;
  net_amount: number | string | null; settlement_status: string | null;
};
const fieldClass = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-sky-100";
const money = (value: unknown) => value == null || value === "" ? "-" : `RM ${Number(value).toLocaleString("en-MY",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const date = (value: string | null) => value?.split("-").reverse().join("/") ?? "-";

export function PolicyEndorsements({ policyTermId, rows, currentGross, commissions, rules, grossRate, netRate }: {
  policyTermId: string; rows: PolicyEndorsement[]; currentGross: number;
  rules: CommissionRule[]; grossRate: number; netRate: number;
  commissions: Array<{ amount: number | string | null; calculation_percent: number | string | null; status: string | null }>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<PolicyEndorsement | null | undefined>(undefined);
  const [version, setVersion] = useState(0);
  const [state, action] = useActionState<EndorsementState, FormData>(saveEndorsement, {});
  useEffect(() => {
    if (state.success) { setEditing(undefined); setVersion(value => value+1); router.refresh(); }
  }, [state.resultId, state.success, router]);
  return <section className="crm-card">
    <div className="crm-card-header flex items-center justify-between gap-2">
      <h2 className="font-semibold text-slate-800">Endorsements</h2>
      <button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 text-sm text-sky-700" onClick={() => setEditing(null)}><Plus className="h-4 w-4" />Add endorsement</button>
    </div>
    <div className="space-y-3 p-4">
      <ActionMessage tone="success" message={state.success} messageKey={state.resultId} />
      <ActionMessage tone="error" message={state.error} messageKey={state.resultId} />
      {editing !== undefined && <EndorsementForm key={`${editing?.id ?? "new"}-${version}`} row={editing} action={action}
        policyTermId={policyTermId} currentGross={currentGross} commissions={commissions} rules={rules} grossRate={grossRate} netRate={netRate} onCancel={() => setEditing(undefined)} />}
      <div className="overflow-x-auto">
        <table className="crm-table min-w-[850px]">
          <thead><tr><th className="px-3 py-2">Endorsement No.</th><th className="px-3 py-2">Issued / Effective</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Premium +/−</th><th className="px-3 py-2">ST +/−</th><th className="px-3 py-2">Net payable / refund</th><th className="px-3 py-2">Settlement</th><th className="px-3 py-2" /></tr></thead>
          <tbody>{rows.map(row => <tr key={row.id}>
            <td className="px-3 py-2">{row.endorsement_number ?? "-"}</td>
            <td className="whitespace-nowrap px-3 py-2">{date(row.issue_date)}<br /><span className="text-slate-500">{date(row.effective_date)}</span></td>
            <td className="max-w-[260px] whitespace-normal break-words px-3 py-2">{row.description}</td>
            <td className="whitespace-nowrap px-3 py-2">{money(row.premium_change)}</td><td className="whitespace-nowrap px-3 py-2">{money(row.service_tax_change)}</td>
            <td className="whitespace-nowrap px-3 py-2 font-semibold">{money(row.net_amount)}</td>
            <td className="px-3 py-2"><span className={row.settlement_status === "settled" ? "text-emerald-700" : "text-amber-700"}>{row.settlement_status === "settled" ? "Settled" : "Pending"}</span></td>
            <td className="px-3 py-2"><button title="Edit endorsement" aria-label="Edit endorsement" type="button" onClick={() => setEditing(row)} className="p-2 text-sky-700"><Pencil className="h-4 w-4" /></button></td>
          </tr>)}
          {!rows.length && <tr><td colSpan={8} className="py-5 text-center text-slate-500">No endorsements.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  </section>;
}

function EndorsementForm({ row, action, policyTermId, onCancel, currentGross, commissions, rules, grossRate, netRate }: {
  row: PolicyEndorsement | null; action: (data: FormData) => void; policyTermId: string; onCancel: () => void;
  rules: CommissionRule[]; grossRate: number; netRate: number;
  currentGross: number; commissions: Array<{amount:number|string|null;calculation_percent:number|string|null;status:string|null}>;
}) {
  const [premium, setPremium] = useState(String(row?.premium_change ?? ""));
  const [tax, setTax] = useState(String(row?.service_tax_change ?? ""));
  const [override, setOverride] = useState(row?.net_amount != null && Number(row.net_amount) !== Number(row.premium_change ?? 0)+Number(row.service_tax_change ?? 0));
  const [net, setNet] = useState(String(row?.net_amount ?? ""));
  const nextGross = currentGross - Number(row?.premium_change ?? 0) + (nullableNumber(premium) ?? 0);
  const changed = nextGross !== currentGross && commissions.length > 0;
  const previousCommission = commissions.reduce((sum,value) => sum+Number(value.amount ?? 0),0);
  const nextCommission = calculateCommissionRows({grossPremium:nextGross,grossCommissionPercent:grossRate,netCommissionPercent:netRate,rules}).reduce((sum,row) => sum+row.amount,0);
  return <form action={action} className="space-y-4 border-b border-slate-200 pb-4">
    <input type="hidden" name="policy_term_id" value={policyTermId} /><input type="hidden" name="endorsement_id" value={row?.id ?? ""} />
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Field label="Endorsement No."><input name="endorsement_number" className={fieldClass} defaultValue={row?.endorsement_number ?? ""} /></Field>
      <Field label="Date of Issue" required><PolicyDateInput name="issue_date" defaultValue={row?.issue_date} required /></Field>
      <Field label="Effective Date" required><PolicyDateInput name="effective_date" defaultValue={row?.effective_date} required /></Field>
      <Field label="Premium Change (RM)" required><input name="premium_change" type="text" inputMode="decimal" className={fieldClass} required value={premium} onChange={event => setPremium(event.target.value)} placeholder="+100.00 or -100.00" /></Field>
      <Field label="Service Tax Change (RM)"><input name="service_tax_change" type="text" inputMode="decimal" className={fieldClass} value={tax} onChange={event => setTax(event.target.value)} /></Field>
      <Field label="Net Payable / Refund (RM)">
        <input name="net_amount" type="text" inputMode="decimal" className={fieldClass} readOnly={!override}
          value={override ? net : ((nullableNumber(premium) ?? 0)+(nullableNumber(tax) ?? 0)).toFixed(2)} onChange={event => setNet(event.target.value)} />
        <label className="mt-2 flex gap-2 text-xs text-slate-600"><input type="checkbox" checked={override} onChange={event => setOverride(event.target.checked)} />Override net amount</label>
      </Field>
      <Field label="Settlement"><select className={fieldClass} name="settlement_status" defaultValue={row?.settlement_status ?? "pending"}><option value="pending">Pending</option><option value="settled">Settled</option></select></Field>
      <div className="md:col-span-2"><Field label="Description" required><textarea className={fieldClass+" min-h-20 py-2"} name="description" defaultValue={row?.description ?? ""} required /></Field></div>
    </div>
    {changed && <div role="alert" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <p>Premium changed – commission was {money(previousCommission)}, recalculated would be {money(nextCommission)}</p>
      <p>Paid commissions remain unchanged.</p>
      <select aria-label="Commission decision" required name="commission_decision" defaultValue="" className={fieldClass}><option value="" disabled>Choose commission action</option><option value="update">Update unpaid commissions</option><option value="keep">Keep existing commissions</option></select>
    </div>}
    <div className="flex gap-2"><SaveButton /><button type="button" onClick={onCancel} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm"><X className="h-4 w-4" />Cancel</button></div>
  </form>;
}
function Field({label,required,children}:{label:string;required?:boolean;children:React.ReactNode}) {
  return <div className="min-w-0"><label className="mb-2 block text-sm font-medium text-slate-700">{label}{required && <span className="ml-1 text-red-600">*</span>}</label>{children}</div>;
}
function SaveButton() {
  const {pending}=useFormStatus();
  return <button disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-700 px-3 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{pending ? "Saving..." : "Save endorsement"}</button>;
}
