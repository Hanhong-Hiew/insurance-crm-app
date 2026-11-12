"use client";

import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { changeCommissionRow } from "@/app/protected/policies/[id]/commission-actions";
import { ActionMessage } from "@/components/action-message";
import { PolicyDateInput } from "@/components/policy-date-input";
import { formatPercent } from "@/lib/format";

type Row={id:string;payee_id:string;payee_name:string;amount:number|string|null;unpaid_amount:number|string|null;calculation_percent:number|string|null;status:string|null;paid_date:string|null;statement:string;entry_kind?:string|null;adjustment_note?:string|null};
const field="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800";
const money=(value:number|string|null)=>value==null?"-":`RM ${Number(value).toLocaleString("en-MY",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

export function PolicyCommissions({policyTermId,rows,payees}:{policyTermId:string;rows:Row[];payees:Array<{id:string;name:string|null}>}) {
  const [editing,setEditing]=useState<Row|null|undefined>();
  const [state,action,pending]=useActionState(changeCommissionRow,{});
  const router=useRouter();
  useEffect(()=>{if(state.success){setEditing(undefined);router.refresh();}},[state.resultId,state.success,router]);
  function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);startTransition(()=>action(data));}
  return <section className="crm-card">
    <div className="crm-card-header flex items-center justify-between gap-2"><h2 className="font-semibold text-slate-800">Commissions</h2><button type="button" onClick={()=>setEditing(null)} className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-sky-700"><Plus className="h-4 w-4"/>Add commission adjustment</button></div>
    <div className="px-4 pt-3"><ActionMessage tone="error" message={state.error} messageKey={state.resultId}/><ActionMessage tone="success" message={state.success} messageKey={state.resultId}/></div>
    {editing!==undefined && <AdjustmentForm key={editing?.id??"new"} row={editing} policyTermId={policyTermId} payees={payees} pending={pending} submit={submit} cancel={()=>setEditing(undefined)}/>}
    <div className="overflow-x-auto"><table className="crm-table min-w-[850px]"><thead><tr>{["Payee","Rate / Type","Amount","Unpaid","Status","Paid date","Statement",""].map((heading,index)=><th className="px-3 py-3" key={index}>{heading}</th>)}</tr></thead>
      <tbody>{rows.map(row=><tr key={row.id}>
        <td className="px-3 py-3 font-medium">{row.payee_name}</td><td className="px-3 py-3">{row.entry_kind==="adjustment"?<span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">Adjustment</span>:formatPercent(row.calculation_percent)}{row.adjustment_note&&<p className="mt-1 max-w-56 whitespace-normal break-words text-xs text-slate-600">{row.adjustment_note}</p>}</td>
        <td className="whitespace-nowrap px-3 py-3">{money(row.amount)}</td><td className="whitespace-nowrap px-3 py-3">{money(row.unpaid_amount)}</td><td className="px-3 py-3">{row.status}</td>
        <td className="px-3 py-3">{row.status==="paid"?<form method="post" onSubmit={submit} className="flex min-w-[180px] items-center gap-1"><input type="hidden" name="operation" value="paid_date"/><input type="hidden" name="policy_term_id" value={policyTermId}/><input type="hidden" name="commission_id" value={row.id}/><PolicyDateInput name="paid_date" defaultValue={row.paid_date} required/><button disabled={pending} title="Save paid date" aria-label="Save paid date" className="p-2 text-sky-700 disabled:opacity-50"><Save className="h-4 w-4"/></button></form>:"-"}</td>
        <td className="px-3 py-3">{row.statement}</td><td className="px-3 py-3">{row.entry_kind==="adjustment"&&row.status==="unpaid"&&<button type="button" title="Edit adjustment" aria-label="Edit adjustment" className="p-2 text-sky-700" onClick={()=>setEditing(row)}><Pencil className="h-4 w-4"/></button>}</td>
      </tr>)}{!rows.length&&<tr><td colSpan={8} className="p-5 text-center text-slate-500">No commission rows.</td></tr>}</tbody></table></div>
  </section>;
}

function AdjustmentForm({row,policyTermId,payees,pending,submit,cancel}:{row:Row|null;policyTermId:string;payees:Array<{id:string;name:string|null}>;pending:boolean;submit:(event:React.FormEvent<HTMLFormElement>)=>void;cancel:()=>void}) {
  const [status,setStatus]=useState(row?.status??"unpaid");
  const [confirmDelete,setConfirmDelete]=useState(false);
  const today=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kuching"}).format(new Date());
  return <div className="border-b border-slate-200 p-4"><form method="post" onSubmit={submit} className="space-y-3"><input type="hidden" name="operation" value="save"/><input type="hidden" name="policy_term_id" value={policyTermId}/><input type="hidden" name="commission_id" value={row?.id??""}/>
    <div className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-sm"><span>Payee <span className="text-red-600">*</span></span><select name="payee_id" className={field} required defaultValue={row?.payee_id??""}><option value="" disabled>Select payee</option>{payees.map(payee=><option key={payee.id} value={payee.id}>{payee.name}</option>)}</select></label>
    <label className="grid gap-1 text-sm"><span>Amount (RM) <span className="text-red-600">*</span></span><input className={field} name="amount" inputMode="decimal" required defaultValue={row?.amount==null?"":Number(row.amount).toFixed(2)} placeholder="100.00 or -100.00" onBlur={event=>{const amount=Number(event.target.value.replace(/,/g,""));if(event.target.value.trim()&&Number.isFinite(amount)&&/^[+-]?[\d,]+(?:\.\d{1,2})?$/.test(event.target.value))event.target.value=amount.toFixed(2);}}/></label>
    <label className="grid gap-1 text-sm">Status<select className={field} name="status" value={status} onChange={event=>setStatus(event.target.value)}><option value="unpaid">Unpaid</option><option value="paid">Paid</option></select></label>
    {status==="paid"&&<label className="grid gap-1 text-sm"><span>Paid date <span className="text-red-600">*</span></span><PolicyDateInput name="paid_date" defaultValue={row?.paid_date??today} required/></label>}
    <label className="grid gap-1 text-sm md:col-span-2"><span>Note <span className="text-red-600">*</span></span><textarea name="note" className={field+" min-h-20 py-2"} required defaultValue={row?.adjustment_note??""}/></label></div>
    <div className="flex gap-2"><button disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-3 py-2 text-sm text-white disabled:opacity-50"><Save className="h-4 w-4"/>{pending?"Saving...":"Save adjustment"}</button><button type="button" onClick={cancel} className="inline-flex items-center gap-2 px-3 text-sm"><X className="h-4 w-4"/>Cancel</button></div>
  </form>{row&&<form method="post" onSubmit={submit} className="mt-3"><input type="hidden" name="operation" value="delete"/><input type="hidden" name="policy_term_id" value={policyTermId}/><input type="hidden" name="commission_id" value={row.id}/>{confirmDelete?<div className="flex items-center gap-2 text-sm text-red-800"><span>Delete this unpaid adjustment?</span><button disabled={pending} className="rounded border border-red-300 px-3 py-2">Confirm delete</button><button type="button" onClick={()=>setConfirmDelete(false)}>Keep</button></div>:<button type="button" className="inline-flex items-center gap-2 text-sm text-red-700" onClick={()=>setConfirmDelete(true)}><Trash2 className="h-4 w-4"/>Delete adjustment</button>}</form>}</div>;
}
