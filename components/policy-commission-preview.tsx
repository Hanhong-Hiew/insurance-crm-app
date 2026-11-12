"use client";

import { formatPercent } from "@/lib/format";
import type { CommissionPreviewRow } from "@/lib/commission";

export function PolicyCommissionPreview({ rows, grossRate, netRate, existing = [] }: {
  existing?: Array<{payee_id:string;payee_name?:string|null;calculation_percent?:number|string|null;amount:number|string|null;status:string|null}>;
  rows: CommissionPreviewRow[]; grossRate?: number | string | null; netRate?: number | string | null;
}) {
  const money = (value: number) => `RM ${value.toLocaleString("en-MY",{ minimumFractionDigits:2,maximumFractionDigits:2 })}`;
  const displayRows = [...rows, ...existing.filter(saved => saved.status === "paid" && !rows.some(row => row.payee_id === saved.payee_id)).map(saved => ({payee_id:saved.payee_id,payee_name:saved.payee_name || "Previously paid payee",calculation_percent:Number(saved.calculation_percent ?? 0),amount:Number(saved.amount ?? 0)}))];
  const amountFor = (row: CommissionPreviewRow) => {
    const saved = existing.find(value => value.payee_id === row.payee_id && value.status === "paid");
    return saved ? Number(saved.amount ?? 0) : row.amount;
  };
  return <section className="crm-card">
    <div className="crm-card-header flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-semibold text-slate-800">Commission</h2>
      <p className="text-xs text-slate-600">Gross rate {formatPercent(grossRate)} · Net rate {formatPercent(netRate)}</p>
    </div>
    <div className="overflow-x-auto">
      <table className="crm-table min-w-[400px]"><thead><tr><th className="px-4 py-2">Payee</th><th className="px-4 py-2">Rate</th><th className="px-4 py-2">Calculated amount</th></tr></thead>
        <tbody>{displayRows.map(row => <tr key={row.payee_id}><td className="px-4 py-2">{row.payee_name}</td><td className="px-4 py-2">{formatPercent(existing.find(saved => saved.payee_id === row.payee_id && saved.status === "paid")?.calculation_percent ?? row.calculation_percent)}</td><td className="px-4 py-2">{money(amountFor(row))}{existing.some(value => value.payee_id === row.payee_id && value.status === "paid") && <span className="ml-2 text-xs text-emerald-700">Paid · kept</span>}</td></tr>)}
          {!displayRows.length && <tr><td colSpan={3} className="px-4 py-4 text-slate-500">Select Gross Premium and a commission split.</td></tr>}
        </tbody>
        {!!displayRows.length && <tfoot><tr><td className="px-4 py-2 font-semibold" colSpan={2}>Total</td><td className="px-4 py-2 font-semibold">{money(displayRows.reduce((sum,row) => sum+amountFor(row),0))}</td></tr></tfoot>}
      </table>
    </div>
  </section>;
}
