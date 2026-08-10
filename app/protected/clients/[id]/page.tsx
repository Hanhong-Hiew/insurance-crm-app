import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { AppMenu } from "@/components/app-menu";
import { ClientDetailForm } from "@/components/client-detail-form";
import { CRM_LIST_LIMIT } from "@/lib/query-limits";
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
      .limit(CRM_LIST_LIMIT),
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
        <section className="crm-card">
          <div className="crm-card-header">
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

        <section className="crm-card">
          <div className="crm-card-header">
            <h2 className="font-semibold text-slate-800">Linked Policies</h2>
            <p className="text-xs text-slate-500">
              Policies remain linked even when you edit the client name.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="crm-table min-w-[760px]">
              <thead>
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
                    <tr key={policy.policy_term_id}>
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
    <main className="crm-page">
      <header className="crm-header">
        <div className="crm-header-inner">
          <div>
            <Link
              className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-sky-700"
              href="/protected/clients"
            >
              <ArrowLeft className="h-4 w-4" />
              Clients
            </Link>
            <p className="crm-kicker">Client file</p>
            <h1 className="crm-page-title">Client Record</h1>
            <p className="crm-page-subtitle">
              Review client details, addresses, and linked policy history.
            </p>
          </div>
          <AppMenu activeHref="/protected/clients" path={["Dashboard", "Clients", "Client"]} />
        </div>
      </header>
      <div className="crm-container">{children}</div>
    </main>
  );
}
