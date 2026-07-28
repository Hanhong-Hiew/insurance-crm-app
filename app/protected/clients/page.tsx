import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

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
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-950">
      <header className="border-b border-sky-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-sky-700"
              href="/protected"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <h1 className="text-2xl font-semibold">Client Master</h1>
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
      <div className="mx-auto max-w-[1800px] px-4 py-5">{children}</div>
    </main>
  );
}
