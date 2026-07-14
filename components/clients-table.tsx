"use client";

import { Plus, Search, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createClientRecord,
  deleteClientRecord,
  type ClientActionState,
} from "@/app/protected/clients/actions";

export type ClientTableRow = {
  id: string;
  client_code: string | null;
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

export function ClientsTable({ clients }: { clients: ClientTableRow[] }) {
  const [query, setQuery] = useState("");
  const [createState, createAction] = useActionState<ClientActionState, FormData>(
    createClientRecord,
    {},
  );
  const [deleteState, deleteAction] = useActionState<ClientActionState, FormData>(
    deleteClientRecord,
    {},
  );

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

  return (
    <section className="rounded-xl border border-slate-200 bg-white/95 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-sky-100 bg-sky-50/50 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <Users className="h-5 w-5 text-sky-700" />
            Clients
          </h1>
          <p className="text-xs text-slate-500">
            Master list for names, registration numbers, contacts, and linked policies.
          </p>
        </div>
        <label className="relative block w-full md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search client, reg no, phone, email"
            value={query}
          />
        </label>
      </div>

      <div className="grid gap-3 border-b border-slate-100 p-4">
        {createState.error || deleteState.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {createState.error || deleteState.error}
          </div>
        ) : null}
        {createState.success || deleteState.success ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {createState.success || deleteState.success}
          </div>
        ) : null}

        <form
          action={createAction}
          className="grid gap-3 rounded-xl border border-sky-100 bg-sky-50/40 p-3 md:grid-cols-[1.4fr_1fr_0.9fr_1fr_1fr_auto]"
        >
          <input
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            name="client_name"
            placeholder="Client name"
            required
          />
          <input
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            name="business_registration_no"
            placeholder="Reg no"
          />
          <select
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            name="client_type"
          >
            <option value="individual">Individual</option>
            <option value="company">Company</option>
            <option value="other">Other</option>
          </select>
          <input
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            name="phone"
            placeholder="Phone"
          />
          <input
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            name="email"
            placeholder="Email"
            type="email"
          />
          <CreateClientButton />
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-white text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3 font-medium">Client</th>
              <th className="px-3 py-3 font-medium">Reg No</th>
              <th className="px-3 py-3 font-medium">Type</th>
              <th className="px-3 py-3 font-medium">Phone</th>
              <th className="px-3 py-3 font-medium">Email</th>
              <th className="px-3 py-3 font-medium">Address</th>
              <th className="px-3 py-3 font-medium">Policies</th>
              <th className="px-3 py-3 font-medium">Open</th>
              <th className="px-3 py-3 font-medium">Delete</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.length ? (
              filteredClients.map((client) => (
                <tr className="border-b border-slate-100 hover:bg-slate-50" key={client.id}>
                  <td className="px-3 py-3 font-medium text-slate-900">
                    <Link className="hover:text-sky-700" href={`/protected/clients/${client.id}`}>
                      {clean(client.client_name)}
                    </Link>
                    <p className="text-xs font-normal text-slate-500">
                      {clean(client.client_code)}
                    </p>
                  </td>
                  <td className="px-3 py-3">{clean(client.business_registration_no)}</td>
                  <td className="px-3 py-3">{clean(client.client_type)}</td>
                  <td className="px-3 py-3">{clean(client.phone)}</td>
                  <td className="px-3 py-3">{clean(client.email)}</td>
                  <td className="max-w-xs truncate px-3 py-3">{clean(client.address)}</td>
                  <td className="px-3 py-3">{client.policy_count}</td>
                  <td className="px-3 py-3">
                    <Link
                      className="font-medium text-sky-700 hover:text-sky-900"
                      href={`/protected/clients/${client.id}`}
                    >
                      Open
                    </Link>
                  </td>
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
                <td className="px-3 py-8 text-center text-slate-500" colSpan={9}>
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
