"use client";

import { Plus, Search, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createClientRecord,
  deleteClientRecord,
  type ClientActionState,
} from "@/app/protected/clients/actions";
import { ActionMessage } from "@/components/action-message";

export type ClientTableRow = {
  id: string;
  referral: string | null;
  client_name: string | null;
  business_registration_no: string | null;
  client_type: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  policy_count: number;
};

function clean(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replaceAll("_", " ");
}

export function ClientsTable({
  clients,
  referralOptions,
}: {
  clients: ClientTableRow[];
  referralOptions: string[];
}) {
  const [query, setQuery] = useState("");
  const [createState, createAction] = useActionState<ClientActionState, FormData>(
    createClientRecord,
    {},
  );
  const [deleteState, deleteAction] = useActionState<ClientActionState, FormData>(
    deleteClientRecord,
    {},
  );
  const [newReferral, setNewReferral] = useState("");
  const [showReferralSuggestions, setShowReferralSuggestions] = useState(false);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) =>
      Object.values(client).some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [clients, query]);
  const filteredReferralOptions = useMemo(() => {
    const q = newReferral.trim().toLowerCase();
    const options = q
      ? referralOptions.filter((referral) => referral.toLowerCase().includes(q))
      : referralOptions;
    return options.slice(0, 8);
  }, [newReferral, referralOptions]);

  useEffect(() => {
    if (createState.success) {
      setNewReferral("");
      setShowReferralSuggestions(false);
    }
  }, [createState.success]);

  return (
    <section className="crm-card">
      <div className="crm-card-header flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <Users className="h-5 w-5 text-sky-700" />
            Clients
          </h1>
          <p className="text-xs text-slate-500">
            Master list for names, IC / business reg numbers, contacts, and linked policies.
          </p>
        </div>
        <label className="relative block w-full md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="crm-control h-9 w-full pl-9"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search client, IC/reg no, phone, email"
            value={query}
          />
        </label>
      </div>

      <div className="grid gap-3 border-b border-slate-100 p-4">
        <ActionMessage message={createState.error || deleteState.error} tone="error" />
        <ActionMessage message={createState.success || deleteState.success} tone="success" />

        <form
          action={createAction}
          className="grid gap-3 rounded-xl border border-sky-100 bg-sky-50/40 p-3 md:grid-cols-[1.3fr_1fr_0.8fr_1fr_1fr_1fr_auto]"
        >
          <input
            className="crm-control h-9"
            name="client_name"
            placeholder="Client name"
            required
          />
          <input
            className="crm-control h-9"
            name="business_registration_no"
            placeholder="IC / Business Reg. No."
          />
          <select
            className="crm-control h-9"
            name="client_type"
          >
            <option value="individual">Individual</option>
            <option value="company">Company</option>
            <option value="other">Other</option>
          </select>
          <input
            className="crm-control h-9"
            name="phone"
            placeholder="Phone"
          />
          <input
            className="crm-control h-9"
            name="email"
            placeholder="Email"
            type="email"
          />
          <div className="relative">
            <input
              autoComplete="off"
              className="crm-control h-9 w-full"
              name="referral"
              onBlur={() => {
                window.setTimeout(() => setShowReferralSuggestions(false), 120);
              }}
              onChange={(event) => {
                setNewReferral(event.target.value);
                setShowReferralSuggestions(true);
              }}
              onFocus={() => setShowReferralSuggestions(true)}
              placeholder="Referral"
              value={newReferral}
            />
            {showReferralSuggestions && filteredReferralOptions.length ? (
              <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-sky-200 bg-slate-900 py-1 shadow-lg">
                {filteredReferralOptions.map((referral) => (
                  <button
                    className="block w-full px-3 py-2 text-left text-sm text-white transition hover:bg-sky-700"
                    key={referral}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setNewReferral(referral);
                      setShowReferralSuggestions(false);
                    }}
                    type="button"
                  >
                    {referral}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <CreateClientButton />
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="crm-table min-w-[1040px]">
          <thead>
            <tr>
              <th className="px-3 py-3 font-medium">Client</th>
              <th className="px-3 py-3 font-medium">IC / Business Reg. No.</th>
              <th className="px-3 py-3 font-medium">Type</th>
              <th className="px-3 py-3 font-medium">Phone</th>
              <th className="px-3 py-3 font-medium">Email</th>
              <th className="px-3 py-3 font-medium">Address</th>
              <th className="px-3 py-3 font-medium">Policies</th>
              <th className="px-3 py-3 font-medium">Delete</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.length ? (
              filteredClients.map((client) => (
                <tr key={client.id}>
                  <td className="px-3 py-3 font-medium text-slate-900">
                    <Link className="hover:text-sky-700" href={`/protected/clients/${client.id}`}>
                      {clean(client.client_name)}
                    </Link>
                    {client.referral ? (
                      <p className="mt-1 text-xs font-normal text-slate-500">
                        Referral: {client.referral}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">{clean(client.business_registration_no)}</td>
                  <td className="px-3 py-3">{clean(client.client_type)}</td>
                  <td className="px-3 py-3">{clean(client.phone)}</td>
                  <td className="px-3 py-3">{clean(client.email)}</td>
                  <td className="max-w-xs truncate px-3 py-3">{clean(client.address)}</td>
                  <td className="px-3 py-3">{client.policy_count}</td>
                  <td className="px-3 py-3">
                    <form action={deleteAction}>
                      <input name="client_id" type="hidden" value={client.id} />
                      <input
                        name="client_name"
                        type="hidden"
                        value={client.client_name ?? ""}
                      />
                      <DeleteClientButton
                        clientName={client.client_name ?? "this client"}
                        disabled={client.policy_count > 0}
                      />
                    </form>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-8 text-center text-slate-500" colSpan={8}>
                  No matching clients.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CreateClientButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      disabled={pending}
      type="submit"
    >
      <Plus className="h-4 w-4" />
      {pending ? "Adding..." : "Add"}
    </button>
  );
}

function DeleteClientButton({
  clientName,
  disabled,
}: {
  clientName: string;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-white text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
      disabled={disabled || pending}
      onClick={(event) => {
        if (!window.confirm(`Delete ${clientName}? This cannot be undone.`)) {
          event.preventDefault();
        }
      }}
      title={disabled ? "Clients with linked policies cannot be deleted" : "Delete client"}
      type="submit"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
