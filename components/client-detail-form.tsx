"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  updateClient,
  type UpdateClientState,
} from "@/app/protected/clients/[id]/actions";

type ClientFormRecord = {
  id: string;
  client_code: string | null;
  client_name: string | null;
  client_type: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

const fieldClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

export function ClientDetailForm({ client }: { client: ClientFormRecord }) {
  const [state, formAction] = useActionState<UpdateClientState, FormData>(
    updateClient,
    {},
  );

  return (
    <form action={formAction} className="grid gap-4 p-4">
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

      <input name="client_id" type="hidden" value={client.id} />
      <Field label="Client Name">
        <input
          className={fieldClass}
          defaultValue={client.client_name ?? ""}
          name="client_name"
          required
        />
      </Field>
      <Field label="Client Code">
        <input
          className={fieldClass}
          defaultValue={client.client_code ?? ""}
          name="client_code"
          placeholder="Optional"
        />
      </Field>
      <Field label="Client Type">
        <select
          className={fieldClass}
          defaultValue={client.client_type ?? "individual"}
          name="client_type"
        >
          <option value="individual">Individual</option>
          <option value="company">Company</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Phone">
        <input className={fieldClass} defaultValue={client.phone ?? ""} name="phone" />
      </Field>
      <Field label="Email">
        <input
          className={fieldClass}
          defaultValue={client.email ?? ""}
          name="email"
          type="email"
        />
      </Field>
      <Field label="Address">
        <textarea
          className={`${fieldClass} min-h-24 py-2`}
          defaultValue={client.address ?? ""}
          name="address"
        />
      </Field>
      <Field label="Notes">
        <textarea
          className={`${fieldClass} min-h-24 py-2`}
          defaultValue={client.notes ?? ""}
          name="notes"
        />
      </Field>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      disabled={pending}
      type="submit"
    >
      <Save className="h-4 w-4" />
      {pending ? "Saving..." : "Save Client"}
    </button>
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
