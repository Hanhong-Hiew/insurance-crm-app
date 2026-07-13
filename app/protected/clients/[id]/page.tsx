import { ArrowLeft, FileText, Save } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";

import { updateClient } from "./actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

const fieldClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

function clean(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replaceAll("_", " ");
}

function money(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount === 0) return "-";
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: unknown) {
  if (!value) return "-";
  const parsed = new Date(`${String(value)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export default function ClientDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={<PageShell>Loading client...</PageShell>}>
      <ClientDetailContent params={params} />
    </Suspense>
  );
}

async function ClientDetailContent({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData?.claims) {
    redirect("/auth/login");
  }

  const [clientResult, policiesResult] = await Promise.all([
    supabase
      .from("clients")
      .select("id, client_code, client_name, client_type, phone, email, address, notes")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("main_policy_view")
      .select("*")
      .eq("client_id", id)
      .order("expiry_date", { ascending: false }),
  ]);

  if (clientResult.error) throw clientResult.error;
  if (!clientResult.data) notFound();

  const client = clientResult.data;
  const policies = policiesResult.data ?? [];

  return (
    <PageShell>
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-sky-100 bg-sky-50/50 px-4 py-3">
            <h1 className="font-semibold text-slate-800">Client Details</h1>
            <p className="text-xs text-slate-500">
              This is the master client record used by linked policies.
            </p>
          </div>
          <form action={updateClient} className="grid gap-4 p-4">
            <input name="client_id" type="hidden" value={id} />
            <Field label="Client Name">
              <input
                className={fieldClass}
                defaultValue={client.client_name ?? ""}
                name="client_name"
                required
              />
            </Field>
            <Field label="Client Code">
              <input
                className={fieldClass}
                defaultValue={client.client_code ?? ""}
                name="client_code"
                placeholder="Optional"
              />
            </Field>
            <Field label="Client Type">
              <select className={fieldClass} defaultValue={client.client_type ?? "individual"} name="client_type">
                <option value="individual">Individual</option>
                <option value="company">Company</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Phone">
              <input className={fieldClass} defaultValue={client.phone ?? ""} name="phone" />
            </Field>
            <Field label="Email">
              <input className={fieldClass} defaultValue={client.email ?? ""} name="email" type="email" />
            </Field>
            <Field label="Address">
              <textarea
                className={`${fieldClass} min-h-24 py-2`}
                defaultValue={client.address ?? ""}
                name="address"
              />
            </Field>
            <Field label="Notes">
              <textarea
                className={`${fieldClass} min-h-24 py-2`}
                defaultValue={client.notes ?? ""}
                name="notes"
              />
            </Field>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700">
              <Save className="h-4 w-4" />
              Save Client
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-sky-100 bg-sky-50/50 px-4 py-3">
            <h2 className="font-semibold text-slate-800">Linked Policies</h2>
            <p className="text-xs text-slate-500">
              Policies remain linked even when you edit the client name.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-white text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-medium">Policy</th>
                  <th className="px-3 py-3 font-medium">Type</th>
                  <th className="px-3 py-3 font-medium">Risk</th>
                  <th className="px-3 py-3 font-medium">Expiry</th>
                  <th className="px-3 py-3 font-medium">Gross</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Open</th>
                </tr>
              </thead>
              <tbody>
                {policies.length ? (
                  policies.map((policy) => (
                    <tr className="border-b border-slate-100 hover:bg-slate-50" key={policy.policy_term_id}>
                      <td className="px-3 py-3 font-medium">{clean(policy.policy_number)}</td>
                      <td className="px-3 py-3">{clean(policy.insurance_type)}</td>
                      <td className="px-3 py-3">
                        {clean(policy.vehicle_no || policy.primary_risk_label)}
                      </td>
                      <td className="px-3 py-3">{formatDate(policy.expiry_date)}</td>
                      <td className="px-3 py-3">{money(policy.gross_premium)}</td>
                      <td className="px-3 py-3">{clean(policy.policy_status || policy.quotation_status)}</td>
                      <td className="px-3 py-3">
                        <Link
                          className="font-medium text-sky-700 hover:text-sky-900"
                          href={`/protected/policies/${policy.policy_term_id}`}
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-500" colSpan={7}>
                      No linked policies.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      {label}
      {children}
    </label>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-950">
      <header className="border-b border-sky-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-sky-700"
              href="/protected/clients"
            >
              <ArrowLeft className="h-4 w-4" />
              Clients
            </Link>
            <h1 className="text-2xl font-semibold">Client Record</h1>
          </div>
          <Link
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-sky-600 px-3 text-sm font-medium text-white shadow-sm"
            href="/protected/new-policy"
          >
            <FileText className="h-4 w-4" />
            New Policy
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-5">{children}</div>
    </main>
  );
}
