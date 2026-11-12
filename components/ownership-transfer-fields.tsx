"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useState, useTransition } from "react";
import { findMotorTransferCandidates } from "@/app/protected/policies/[id]/accuracy-actions";

export function OwnershipTransferFields({ plate, policyTermId, initialId }: { plate: string; policyTermId?: string; initialId?: string | null }) {
  const [selected, setSelected] = useState(initialId ?? "");
  const [rows, setRows] = useState<Array<{id:string;client_name:string;policy_number:string|null;effective_date:string|null}>>([]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return <section className="crm-panel space-y-3">
    <h2 className="text-sm font-semibold text-slate-800">Ownership transfer</h2>
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 text-sm text-sky-700"
        onClick={() => startTransition(async () => {
          const result = await findMotorTransferCandidates(plate,policyTermId);
          setRows(result.rows); setError(result.error ?? (result.rows.length ? "" : "No previous policies found for this plate."));
        })}><Search className="h-4 w-4" />{pending ? "Searching..." : "Find previous owner / policy"}</button>
      <select aria-label="Transferred from" name="transferred_from_policy_term_id" value={selected}
        onChange={event => setSelected(event.target.value)} className="h-10 min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
        <option value="">No ownership transfer</option>
        {selected && !rows.some(row => row.id === selected) && <option value={selected}>Linked previous policy</option>}
        {rows.map(row => <option key={row.id} value={row.id}>{row.client_name} · {row.policy_number || "No policy number"} · {row.effective_date?.split("-").reverse().join("/")}</option>)}
      </select>
      {selected && <Link className="text-sm font-medium text-sky-700 underline" href={`/protected/policies/${selected}`}>View previous policy</Link>}
    </div>
    {error && <p role="status" className="text-sm text-amber-800">{error}</p>}
  </section>;
}

