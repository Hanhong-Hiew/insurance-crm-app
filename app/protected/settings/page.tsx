import { ArrowLeft, Settings } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { SettingsRowForm } from "@/components/settings-row-form";
import { createClient } from "@/lib/supabase/server";
import {
  saveCommissionRate,
  saveInsuranceType,
  saveInsurer,
  savePayee,
  saveSplitPattern,
} from "./actions";

type InsuranceType = {
  id: string;
  code: string | null;
  name: string | null;
  active: boolean | null;
  notes?: string | null;
};

type Insurer = {
  id: string;
  insurer_name: string | null;
  short_name: string | null;
  active: boolean | null;
  notes?: string | null;
};

type CommissionRate = {
  id: string;
  insurance_type_id: string | null;
  gross_commission_percent: number | string | null;
  net_commission_percent: number | string | null;
  active: boolean | null;
  notes?: string | null;
};

type SplitPattern = {
  id: string;
  code: string | null;
  name: string | null;
  active: boolean | null;
  notes?: string | null;
};

type Payee = {
  id: string;
  name: string | null;
  active: boolean | null;
  notes?: string | null;
};

type SplitRule = {
  id: string;
  fixed_percent: number | string | null;
  rule_type: string | null;
  share_percent: number | string | null;
  split_pattern_id: string | null;
  commission_payees: { name?: string | null } | Array<{ name?: string | null }> | null;
};

function percent(value: number | string | null) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric === 0) return "-";
  return `${(numeric * 100).toFixed(0)}%`;
}

function percentInputValue(value: number | string | null) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric === 0) return "";
  return Number((numeric * 100).toFixed(4)).toString();
}

function clean(value: string | null | undefined) {
  return value || "-";
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageShell title="Settings">Loading...</PageShell>}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  await connection();
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData?.claims) {
    redirect("/auth/login");
  }

  const [typesResult, insurersResult, ratesResult, splitsResult, payeesResult, rulesResult] =
    await Promise.all([
      supabase
        .from("insurance_types")
        .select("id, code, name, active, notes")
        .order("name", { ascending: true }),
      supabase
        .from("insurers")
        .select("id, insurer_name, short_name, active, notes")
        .order("insurer_name", { ascending: true }),
      supabase
        .from("commission_rate_settings")
        .select("id, insurance_type_id, gross_commission_percent, net_commission_percent, active, notes")
        .order("created_at", { ascending: true }),
      supabase
        .from("commission_split_patterns")
        .select("id, code, name, active, notes")
        .order("code", { ascending: true }),
      supabase
        .from("commission_payees")
        .select("id, name, active, notes")
        .order("name", { ascending: true }),
      supabase
        .from("commission_split_rules")
        .select("id, split_pattern_id, rule_type, share_percent, fixed_percent, commission_payees(name)")
        .order("sort_order", { ascending: true }),
    ]);

  const insuranceTypes = (typesResult.data ?? []) as InsuranceType[];
  const insurers = (insurersResult.data ?? []) as Insurer[];
  const rates = (ratesResult.data ?? []) as CommissionRate[];
  const splits = (splitsResult.data ?? []) as SplitPattern[];
  const payees = (payeesResult.data ?? []) as Payee[];
  const rules = (rulesResult.data ?? []) as SplitRule[];
  const typeNameById = new Map(insuranceTypes.map((type) => [type.id, type.name]));
  const rulesBySplitId = new Map<string, string[]>();
  for (const rule of rules) {
    const splitId = rule.split_pattern_id ?? "";
    const payee = Array.isArray(rule.commission_payees)
      ? rule.commission_payees[0]?.name
      : rule.commission_payees?.name;
    const label = `${payee || "Payee"} / ${clean(rule.rule_type)} ${
      rule.fixed_percent ? percent(rule.fixed_percent) : rule.share_percent ? percent(rule.share_percent) : ""
    }`;
    rulesBySplitId.set(splitId, [...(rulesBySplitId.get(splitId) ?? []), label]);
  }
  const errors = [
    typesResult.error?.message,
    insurersResult.error?.message,
    ratesResult.error?.message,
    splitsResult.error?.message,
    payeesResult.error?.message,
    rulesResult.error?.message,
  ].filter((message): message is string => Boolean(message));

  return (
    <PageShell title="Settings">
      {errors.length ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {errors.join(" ")}
        </div>
      ) : null}

      <section className="grid gap-4">
        <SettingsCard
          description="Dropdown options for policy type. Code is used internally; keep it short and stable."
          title="Insurance Types"
        >
          <SettingsHeader
            className="md:grid-cols-[1fr_1fr_auto_auto]"
            labels={["Name", "Code", "Status", "Save"]}
          />
          {insuranceTypes.map((type) => (
            <SettingsRowForm action={saveInsuranceType} className="grid gap-2 border-t border-slate-100 p-3 md:grid-cols-[1fr_1fr_auto_auto]" key={type.id}>
              <input name="id" type="hidden" value={type.id} />
              <TextInput defaultValue={clean(type.name)} name="name" placeholder="Name" />
              <TextInput defaultValue={clean(type.code)} name="code" placeholder="code" />
              <ActiveCheckbox defaultChecked={Boolean(type.active)} />
            </SettingsRowForm>
          ))}
          <SettingsRowForm action={saveInsuranceType} className="grid gap-2 border-t border-sky-100 bg-sky-50/40 p-3 md:grid-cols-[1fr_1fr_auto_auto]" submitLabel="Add">
            <TextInput name="name" placeholder="New insurance type" />
            <TextInput name="code" placeholder="new_code" />
            <ActiveCheckbox defaultChecked />
          </SettingsRowForm>
        </SettingsCard>

        <SettingsCard
          description="Insurer dropdown options used in policy entry and records."
          title="Insurers"
        >
          <SettingsHeader
            className="md:grid-cols-[1fr_1fr_auto_auto]"
            labels={["Insurer", "Short Name", "Status", "Save"]}
          />
          {insurers.map((insurer) => (
            <SettingsRowForm action={saveInsurer} className="grid gap-2 border-t border-slate-100 p-3 md:grid-cols-[1fr_1fr_auto_auto]" key={insurer.id}>
              <input name="id" type="hidden" value={insurer.id} />
              <TextInput defaultValue={clean(insurer.insurer_name)} name="insurer_name" placeholder="Insurer" />
              <TextInput defaultValue={clean(insurer.short_name)} name="short_name" placeholder="Short name" />
              <ActiveCheckbox defaultChecked={Boolean(insurer.active)} />
            </SettingsRowForm>
          ))}
          <SettingsRowForm action={saveInsurer} className="grid gap-2 border-t border-sky-100 bg-sky-50/40 p-3 md:grid-cols-[1fr_1fr_auto_auto]" submitLabel="Add">
            <TextInput name="insurer_name" placeholder="New insurer" />
            <TextInput name="short_name" placeholder="Short name" />
            <ActiveCheckbox defaultChecked />
          </SettingsRowForm>
        </SettingsCard>

        <SettingsCard
          description="Default gross and net commission percentages by insurance type."
          title="Commission Rates"
        >
          <SettingsHeader
            className="md:grid-cols-[1.3fr_1fr_1fr_auto_auto]"
            labels={["Insurance Type", "Gross %", "Net %", "Status", "Save"]}
          />
          {rates.map((rate) => (
            <SettingsRowForm action={saveCommissionRate} className="grid gap-2 border-t border-slate-100 p-3 md:grid-cols-[1.3fr_1fr_1fr_auto_auto]" key={rate.id}>
              <input name="id" type="hidden" value={rate.id} />
              <select className={fieldClass} defaultValue={rate.insurance_type_id ?? ""} name="insurance_type_id">
                {insuranceTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
              <TextInput defaultValue={percentInputValue(rate.gross_commission_percent)} name="gross_commission_percent" placeholder="Gross %" />
              <TextInput defaultValue={percentInputValue(rate.net_commission_percent)} name="net_commission_percent" placeholder="Net %" />
              <ActiveCheckbox defaultChecked={Boolean(rate.active)} />
            </SettingsRowForm>
          ))}
          <SettingsRowForm action={saveCommissionRate} className="grid gap-2 border-t border-sky-100 bg-sky-50/40 p-3 md:grid-cols-[1.3fr_1fr_1fr_auto_auto]" submitLabel="Add">
            <select className={fieldClass} name="insurance_type_id">
              <option value="">Select type</option>
              {insuranceTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
            <TextInput name="gross_commission_percent" placeholder="Gross %" />
            <TextInput name="net_commission_percent" placeholder="Net %" />
            <ActiveCheckbox defaultChecked />
          </SettingsRowForm>
        </SettingsCard>

        <SettingsCard
          description="Split names shown during policy entry. Rule details are shown for checking."
          title="Split Patterns"
        >
          <SettingsHeader
            className="md:grid-cols-[0.7fr_1fr_2fr_auto_auto]"
            labels={["Code", "Name", "Rules", "Status", "Save"]}
          />
          {splits.map((split) => (
            <SettingsRowForm action={saveSplitPattern} className="grid gap-2 border-t border-slate-100 p-3 md:grid-cols-[0.7fr_1fr_2fr_auto_auto]" key={split.id}>
              <input name="id" type="hidden" value={split.id} />
              <TextInput defaultValue={clean(split.code)} name="code" placeholder="Code" />
              <TextInput defaultValue={clean(split.name)} name="name" placeholder="Name" />
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {(rulesBySplitId.get(split.id) ?? ["No rules"]).join(", ")}
              </p>
              <ActiveCheckbox defaultChecked={Boolean(split.active)} />
            </SettingsRowForm>
          ))}
          <SettingsRowForm action={saveSplitPattern} className="grid gap-2 border-t border-sky-100 bg-sky-50/40 p-3 md:grid-cols-[0.7fr_1fr_auto_auto]" submitLabel="Add">
            <TextInput name="code" placeholder="Code" />
            <TextInput name="name" placeholder="Name" />
            <ActiveCheckbox defaultChecked />
          </SettingsRowForm>
        </SettingsCard>

        <SettingsCard
          description="People who can receive commission."
          title="Commission Payees"
        >
          <SettingsHeader
            className="md:grid-cols-[1fr_2fr_auto_auto]"
            labels={["Payee", "Notes", "Status", "Save"]}
          />
          {payees.map((payee) => (
            <SettingsRowForm action={savePayee} className="grid gap-2 border-t border-slate-100 p-3 md:grid-cols-[1fr_2fr_auto_auto]" key={payee.id}>
              <input name="id" type="hidden" value={payee.id} />
              <TextInput defaultValue={clean(payee.name)} name="name" placeholder="Payee" />
              <TextInput defaultValue={clean(payee.notes)} name="notes" placeholder="Notes" />
              <ActiveCheckbox defaultChecked={Boolean(payee.active)} />
            </SettingsRowForm>
          ))}
          <SettingsRowForm action={savePayee} className="grid gap-2 border-t border-sky-100 bg-sky-50/40 p-3 md:grid-cols-[1fr_2fr_auto_auto]" submitLabel="Add">
            <TextInput name="name" placeholder="New payee" />
            <TextInput name="notes" placeholder="Notes" />
            <ActiveCheckbox defaultChecked />
          </SettingsRowForm>
        </SettingsCard>
      </section>
    </PageShell>
  );
}

function PageShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-950">
      <header className="border-b border-sky-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <Link
              className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-sky-700"
              href="/protected"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <Settings className="h-5 w-5" />
              {title}
            </h1>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5">
        {children}
      </div>
    </main>
  );
}

const fieldClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

function TextInput({
  defaultValue,
  name,
  placeholder,
}: {
  defaultValue?: string;
  name: string;
  placeholder: string;
}) {
  return (
    <input
      className={fieldClass}
      defaultValue={defaultValue === "-" ? "" : defaultValue}
      name={name}
      placeholder={placeholder}
    />
  );
}

function ActiveCheckbox({ defaultChecked = false }: { defaultChecked?: boolean }) {
  return (
    <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
      <input defaultChecked={defaultChecked} name="active" type="checkbox" />
      Active
    </label>
  );
}

function SettingsHeader({
  className,
  labels,
}: {
  className: string;
  labels: string[];
}) {
  return (
    <div
      className={`hidden gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase text-slate-500 md:grid ${className}`}
    >
      {labels.map((label) => (
        <span key={label}>{label}</span>
      ))}
    </div>
  );
}

function SettingsCard({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white/95 shadow-sm">
      <div className="border-b border-sky-100 bg-sky-50/50 px-4 py-3">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}
