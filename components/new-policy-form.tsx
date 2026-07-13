"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { savePolicy, type SavePolicyState } from "@/app/protected/new-policy/actions";

type OptionRow = {
  id: string;
  name?: string | null;
  client_name?: string | null;
  insurer_name?: string | null;
  code?: string | null;
};

type NewPolicyFormProps = {
  clients: OptionRow[];
  insuranceTypes: OptionRow[];
  insurers: OptionRow[];
  splitPatterns: OptionRow[];
};

const fieldClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

function optionLabel(row: OptionRow) {
  return row.name || row.client_name || row.insurer_name || row.code || "-";
}

function MoneyInput({
  name,
  placeholder,
  required = false,
}: {
  name: string;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div className="flex h-10 overflow-hidden rounded-lg border border-slate-200 bg-white transition focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100">
      <span className="flex items-center border-r border-sky-100 bg-sky-50 px-3 text-sm font-semibold text-sky-700">
        RM
      </span>
      <input
        className="min-w-0 flex-1 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400"
        inputMode="decimal"
        name={name}
        pattern="[0-9]+([.][0-9]{1,2})?"
        placeholder={placeholder}
        required={required}
        type="text"
      />
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="h-10 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving..." : "Save Policy"}
    </button>
  );
}

export function NewPolicyForm({
  clients,
  insuranceTypes,
  insurers,
  splitPatterns,
}: NewPolicyFormProps) {
  const [state, formAction] = useActionState<SavePolicyState, FormData>(
    savePolicy,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </div>
      ) : null}

      {state.success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {state.success}
        </div>
      ) : null}

      <FormSection
        description="Choose or type the client name. Existing clients will appear as suggestions."
        title="Client"
      >
        <Field label="Client Name">
          <input
            className={fieldClass}
            list="client-options"
            name="client_name"
            placeholder="Type existing client or new client name"
            required
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
        title="Policy"
      >
        <Field label="Insurance Type">
          <select className={fieldClass} name="insurance_type_id" required>
            <option value="">Select insurance type</option>
            {insuranceTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {optionLabel(type)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Insurer">
          <select className={fieldClass} name="insurer_id" required>
            <option value="">Select insurer</option>
            {insurers.map((insurer) => (
              <option key={insurer.id} value={insurer.id}>
                {optionLabel(insurer)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Policy Number">
          <input className={fieldClass} name="policy_number" placeholder="Optional" />
        </Field>

        <Field label="Vehicle No / Risk Label">
          <input
            className={fieldClass}
            name="risk_label"
            placeholder="Vehicle no for motor, risk label for non-motor"
          />
        </Field>
      </FormSection>

      <FormSection
        description="Dates will drive renewal views and follow-up work."
        title="Term"
      >
        <Field label="Effective Date">
          <input
            className={fieldClass}
            inputMode="numeric"
            name="effective_date"
            placeholder="dd/mm/yyyy"
            required
            type="text"
          />
        </Field>

        <Field label="Expiry Date">
          <input
            className={fieldClass}
            inputMode="numeric"
            name="expiry_date"
            placeholder="dd/mm/yyyy"
            required
            type="text"
          />
        </Field>

        <Field label="Sum Assured">
          <MoneyInput name="primary_sum_assured" placeholder="0.00" />
        </Field>
      </FormSection>

      <FormSection
        description="Commission will be calculated from these values and the selected split pattern."
        title="Premium & Commission"
      >
        <Field label="Gross Premium">
          <MoneyInput name="gross_premium" placeholder="0.00" />
        </Field>

        <Field label="Net Premium">
          <MoneyInput name="net_premium" placeholder="0.00" />
        </Field>

        <Field label="Split Pattern">
          <select className={fieldClass} name="split_pattern_id">
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
        title="Notes"
      >
        <div className="md:col-span-2 xl:col-span-3">
          <Field label="Notes">
            <textarea
              className={`${fieldClass} min-h-28 py-2`}
              name="notes"
              placeholder="Internal notes"
            />
          </Field>
        </div>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <SubmitButton />
        <p className="text-sm text-slate-500">
          Saves client, policy series, term, sum assured, motor link when applicable,
          and commission rows.
        </p>
      </div>
    </form>
  );
}

function FormSection({
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
        <p className="text-xs text-slate-500">{description}</p>
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
