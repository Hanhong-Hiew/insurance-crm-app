import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { NewPolicyForm } from "@/components/new-policy-form";
import { createClient } from "@/lib/supabase/server";

type OptionRow = {
  id: string;
  name?: string | null;
  client_name?: string | null;
  insurer_name?: string | null;
  code?: string | null;
};

export default function NewPolicyPage() {
  return (
    <Suspense fallback={<PageShell>Loading...</PageShell>}>
      <NewPolicyContent />
    </Suspense>
  );
}

async function NewPolicyContent() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData?.claims) {
    redirect("/auth/login");
  }

  const [clientsResult, typesResult, insurersResult, splitsResult] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, client_name")
        .order("client_name", { ascending: true })
        .limit(100),
      supabase
        .from("insurance_types")
        .select("id, code, name")
        .eq("active", true)
        .order("name", { ascending: true }),
      supabase
        .from("insurers")
        .select("id, insurer_name")
        .eq("active", true)
        .order("insurer_name", { ascending: true }),
      supabase
        .from("commission_split_patterns")
        .select("id, code, name")
        .eq("active", true)
        .order("code", { ascending: true }),
    ]);

  const clients = (clientsResult.data ?? []) as OptionRow[];
  const insuranceTypes = (typesResult.data ?? []) as OptionRow[];
  const insurers = (insurersResult.data ?? []) as OptionRow[];
  const splitPatterns = (splitsResult.data ?? []) as OptionRow[];
  const errors = [
    clientsResult.error?.message,
    typesResult.error?.message,
    insurersResult.error?.message,
    splitsResult.error?.message,
  ].filter((message): message is string => Boolean(message));

  return (
    <PageShell>
      {errors.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {errors.join(" ")}
        </div>
      ) : null}

      <NewPolicyForm
        clients={clients}
        insuranceTypes={insuranceTypes}
        insurers={insurers}
        splitPatterns={splitPatterns}
      />
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-950">
      <header className="border-b border-sky-100 bg-white/85 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <Link
            className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-sky-700"
            href="/protected"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <div className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                <FileText className="h-5 w-5" />
              </span>
              New Policy Entry
            </h1>
            <p className="text-sm text-slate-500">
              One clean entry screen for client, policy term, premium, and risk details.
            </p>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-5">{children}</div>
    </main>
  );
}
