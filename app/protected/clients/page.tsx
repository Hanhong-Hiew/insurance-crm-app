import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppMenu } from "@/components/app-menu";
import { ClientsTable, type ClientTableRow } from "@/components/clients-table";
import { createClient } from "@/lib/supabase/server";

type ClientRow = {
  id: string;
  referral: string | null;
  client_name: string | null;
  business_registration_no: string | null;
  client_type: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

type PolicyRow = {
  client_id: string | null;
  policy_term_id: string;
};

export default function ClientsPage() {
  return (
    <Suspense fallback={<PageShell>Loading clients...</PageShell>}>
      <ClientsContent />
    </Suspense>
  );
}

async function ClientsContent() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData?.claims) {
    redirect("/auth/login");
  }

  const [clientsResult, policiesResult] = await Promise.all([
    supabase
      .from("clients")
      .select("id, referral, client_name, business_registration_no, client_type, phone, email, address, notes")
      .order("client_name", { ascending: true })
      .limit(500),
    supabase.from("main_policy_view").select("client_id, policy_term_id").limit(2000),
  ]);

  const clients = (clientsResult.data ?? []) as ClientRow[];
  const policies = (policiesResult.data ?? []) as PolicyRow[];
  const policyCountByClient = new Map<string, number>();
  for (const policy of policies) {
    if (!policy.client_id) continue;
    policyCountByClient.set(
      policy.client_id,
      (policyCountByClient.get(policy.client_id) ?? 0) + 1,
    );
  }

  const errors = [clientsResult.error?.message, policiesResult.error?.message].filter(
    (message): message is string => Boolean(message),
  );
  const tableRows: ClientTableRow[] = clients.map((client) => ({
    ...client,
    policy_count: policyCountByClient.get(client.id) ?? 0,
  }));
  const referralOptions = Array.from(
    new Set(
      clients
        .map((client) => client.referral?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

  return (
    <PageShell>
      {errors.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {errors.join(" ")}
        </div>
      ) : null}

      <ClientsTable clients={tableRows} referralOptions={referralOptions} />
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
              href="/protected"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <p className="crm-kicker">Client source of truth</p>
            <h1 className="crm-page-title">Client Master</h1>
            <p className="crm-page-subtitle">
              Manage client details, referral names, and addresses used by policies.
            </p>
          </div>
          <AppMenu activeHref="/protected/clients" path={["Dashboard", "Clients"]} />
        </div>
      </header>
      <div className="crm-container">{children}</div>
    </main>
  );
}
