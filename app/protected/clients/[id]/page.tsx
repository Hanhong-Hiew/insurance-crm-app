import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { ClientDetailForm } from "@/components/client-detail-form";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

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
  return new Intl.DateTimeFormat("en-GB").format(parsed);
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

  const [clientResult, clientAddressesResult, policiesResult, referralsResult] = await Promise.all([
    supabase
      .from("clients")
      .select("id, referral, client_name, business_registration_no, client_type, phone, email, address, notes")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("client_addresses")
      .select("id, client_id, address_label, address, is_default")
      .eq("client_id", id)
      .order("is_default", { ascending: false })
      .order("address_label", { ascending: true }),
    supabase
      .from("main_policy_view")
      .select("*")
      .eq("client_id", id)
      .order("expiry_date", { ascending: false }),
    supabase
      .from("clients")
      .select("referral")
      .not("referral", "is", null)
      .order("referral", { ascending: true })
      .limit(500),
  ]);

  if (clientResult.error) throw clientResult.error;
  if (clientAddressesResult.error) throw clientAddressesResult.error;
  if (!clientResult.data) notFound();

  const client = clientResult.data;
  const clientAddresses = clientAddressesResult.data ?? [];
  const policies = policiesResult.data ?? [];
  const referralOptions = Array.from(
    new Set(
      (referralsResult.data ?? [])
        .map((row) => String(row.referral ?? "").trim())
        .filter(Boolean),
    ),
  );

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
          <ClientDetailForm
            client={client}
            clientAddresses={clientAddresses}
            referralOptions={referralOptions}
          />
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
                </tr>
              </thead>
              <tbody>
                {policies.length ? (
                  policies.map((policy) => (
                    <tr className="border-b border-slate-100 hover:bg-slate-50" key={policy.policy_term_id}>
                      <td className="px-3 py-3 font-medium">
                        <Link
                          className="hover:text-sky-700"
                          href={`/protected/policies/${policy.policy_term_id}`}
                        >
                          {clean(policy.policy_number)}
                        </Link>
                      </td>
                      <td className="px-3 py-3">{clean(policy.insurance_type)}</td>
                      <td className="px-3 py-3">
                        {clean(policy.vehicle_no || policy.primary_risk_label)}
                      </td>
                      <td className="px-3 py-3">{formatDate(policy.expiry_date)}</td>
                      <td className="px-3 py-3">{money(policy.gross_premium)}</td>
                      <td className="px-3 py-3">{clean(policy.policy_status || policy.quotation_status)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-500" colSpan={6}>
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
