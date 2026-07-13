import { ArrowLeft, CalendarDays, FileText, Landmark, ReceiptText, UserRound } from "lucide-react";
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
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {errors.join(" ")}
        </div>
      ) : null}

      <form className="space-y-4">
        <FormSection
          description="Choose or type the client name. Existing clients will appear as suggestions."
          icon={<UserRound className="h-4 w-4" />}
          title="Client"
        >
          <Field label="Client Name">
            <input
              className={fieldClass}
              list="client-options"
              placeholder="Type existing client or new client name"
            />
            <datalist id="client-options">
              {clients.map((client) => (
                <option key={client.id} value={optionLabel(client)} />
              ))}
            </datalist>
          </Field>
        </FormSection>

        <FormSection
          description="Core policy details used for searching, renewals, and reporting."
          icon={<FileText className="h-4 w-4" />}
          title="Policy"
        >
          <Field label="Insurance Type">
            <select className={fieldClass}>
              <option value="">Select insurance type</option>
              {insuranceTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {optionLabel(type)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Insurer">
            <select className={fieldClass}>
              <option value="">Select insurer</option>
              {insurers.map((insurer) => (
                <option key={insurer.id} value={insurer.id}>
                  {optionLabel(insurer)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Policy Number">
            <input className={fieldClass} placeholder="Optional" />
          </Field>

          <Field label="Vehicle No / Risk Label">
            <input
              className={fieldClass}
              placeholder="Vehicle no for motor, risk label for non-motor"
            />
          </Field>
        </FormSection>

        <FormSection
          description="Dates will drive renewal views and follow-up work."
          icon={<CalendarDays className="h-4 w-4" />}
          title="Term"
        >
          <Field label="Effective Date">
            <input className={fieldClass} type="date" />
          </Field>

          <Field label="Expiry Date">
            <input className={fieldClass} type="date" />
          </Field>

          <Field label="Sum Assured">
            <input className={fieldClass} inputMode="decimal" placeholder="RM" />
          </Field>
        </FormSection>

        <FormSection
          description="Commission can be calculated from these values once save logic is wired."
          icon={<ReceiptText className="h-4 w-4" />}
          title="Premium & Commission"
        >
          <Field label="Gross Premium">
            <input className={fieldClass} inputMode="decimal" placeholder="RM" />
          </Field>

          <Field label="Net Premium">
            <input className={fieldClass} inputMode="decimal" placeholder="RM" />
          </Field>

          <Field label="Split Pattern">
            <select className={fieldClass}>
              <option value="">Select split pattern</option>
              {splitPatterns.map((pattern) => (
                <option key={pattern.id} value={pattern.id}>
                  {pattern.code} - {pattern.name}
                </option>
              ))}
            </select>
          </Field>
        </FormSection>

        <FormSection
          description="Internal notes for anything that does not belong in structured fields yet."
          icon={<Landmark className="h-4 w-4" />}
          title="Notes"
        >
          <div className="md:col-span-2 xl:col-span-3">
            <Field label="Notes">
              <textarea
                className={`${fieldClass} min-h-28 py-2`}
                placeholder="Internal notes"
              />
            </Field>
          </div>
        </FormSection>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <button
            className="h-10 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled
            type="button"
          >
            Save Policy
          </button>
          <p className="text-sm text-slate-500">
            Save is disabled until the multi-table save action is wired.
          </p>
        </div>
      </form>
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

const fieldClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

function FormSection({
  children,
  description,
  icon,
  title,
}: {
  children: React.ReactNode;
  description: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white/95 shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            {icon}
          </span>
          <div>
            <h2 className="font-semibold text-slate-950">{title}</h2>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </section>
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
