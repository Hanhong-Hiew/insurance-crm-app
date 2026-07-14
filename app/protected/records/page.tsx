import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { RecordsPanel, type PolicyRecord } from "@/components/records-panel";
import { createClient } from "@/lib/supabase/server";

export default function RecordsPage() {
  return (
    <Suspense fallback={<PageShell>Loading records...</PageShell>}>
      <RecordsContent />
    </Suspense>
  );
}

async function RecordsContent() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData?.claims) {
    redirect("/auth/login");
  }

  const recordsResult = await supabase
    .from("main_policy_view")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);

  const errors = [recordsResult.error?.message].filter(
    (message): message is string => Boolean(message),
  );

  return (
    <PageShell>
      {errors.length ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {errors.join(" ")}
        </div>
      ) : null}
      <RecordsPanel policies={(recordsResult.data ?? []) as PolicyRecord[]} />
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
              href="/protected"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <h1 className="text-2xl font-semibold">Records Analysis</h1>
            <p className="mt-1 text-sm text-slate-500">
              Search, filter, group, and sort policy records.
            </p>
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
