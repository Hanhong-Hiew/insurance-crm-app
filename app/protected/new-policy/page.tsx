import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";

type OptionRow = {
  id: string;
  name?: string | null;
  client_name?: string | null;
  insurer_name?: string | null;
  code?: string | null;
};

function optionLabel(row: OptionRow) {
  return row.name || row.client_name || row.insurer_name || row.code || "-";
}

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
        .select("id, name")
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
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {errors.join(" ")}
        </div>
      ) : null}

      <form className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4 lg:grid-cols-2">
        <Field label="Client">
          <input
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
            list="client-options"
            placeholder="Type existing client or new client name"
          />
          <datalist id="client-options">
            {clients.map((client) => (
              <option key={client.id} value={optionLabel(client)} />
            ))}
          </datalist>
        </Field>

        <Field label="Insurance Type">
          <select className="h-10 rounded-md border border-zinc-300 px-3 text-sm">
            <option value="">Select insurance type</option>
            {insuranceTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {optionLabel(type)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Insurer">
          <select className="h-10 rounded-md border border-zinc-300 px-3 text-sm">
            <option value="">Select insurer</option>
            {insurers.map((insurer) => (
              <option key={insurer.id} value={insurer.id}>
                {optionLabel(insurer)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Split Pattern">
          <select className="h-10 rounded-md border border-zinc-300 px-3 text-sm">
            <option value="">Select split pattern</option>
            {splitPatterns.map((pattern) => (
              <option key={pattern.id} value={pattern.id}>
                {pattern.code} - {pattern.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Policy Number">
          <input
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
            placeholder="Optional"
          />
        </Field>

        <Field label="Vehicle No / Risk Label">
          <input
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
            placeholder="Vehicle no for motor, risk label for non-motor"
          />
        </Field>

        <Field label="Effective Date">
          <input
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
            type="date"
          />
        </Field>

        <Field label="Expiry Date">
          <input
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
            type="date"
          />
        </Field>

        <Field label="Sum Assured">
          <input
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
            inputMode="decimal"
            placeholder="RM"
          />
        </Field>

        <Field label="Gross Premium">
          <input
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
            inputMode="decimal"
            placeholder="RM"
          />
        </Field>

        <Field label="Net Premium">
          <input
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
            inputMode="decimal"
            placeholder="RM"
          />
        </Field>

        <div className="lg:col-span-2">
          <label className="grid gap-2 text-sm font-medium">
            Notes
            <textarea
              className="min-h-24 rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Internal notes"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 lg:col-span-2">
          <button
            className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled
            type="button"
          >
            Save Policy
          </button>
          <p className="self-center text-sm text-zinc-500">
            Save is intentionally disabled until the multi-table save action is wired.
          </p>
        </div>
      </form>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <Link
            className="mb-2 inline-flex items-center gap-2 text-sm text-zinc-600"
            href="/protected"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <FileText className="h-5 w-5" />
            New Policy Entry
          </h1>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-5">{children}</div>
    </main>
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
    <label className="grid gap-2 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
