"use client";

import { Search, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
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
