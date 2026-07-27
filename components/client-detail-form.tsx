"use client";

import { MapPin, Save } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  updateClient,
  type UpdateClientState,
} from "@/app/protected/clients/[id]/actions";
import { ActionMessage } from "@/components/action-message";

type ClientFormRecord = {
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

type ClientAddressRecord = {
  id: string;
  address: string | null;
  address_label: string | null;
  client_id: string | null;
  is_default: boolean | null;
};

const fieldClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

export function ClientDetailForm({
  client,
  clientAddresses,
  referralOptions,
}: {
  client: ClientFormRecord;
  clientAddresses: ClientAddressRecord[];
  referralOptions: string[];
}) {
  const [state, formAction] = useActionState<UpdateClientState, FormData>(
    updateClient,
    {},
  );

  return (
    <form action={formAction} className="grid gap-4 p-4">
      <ActionMessage message={state.error} tone="error" />
      <ActionMessage message={state.success} tone="success" />

      <input name="client_id" type="hidden" value={client.id} />
      <Field label="Client Name">
        <input
          className={fieldClass}
          defaultValue={client.client_name ?? ""}
          name="client_name"
          required
        />
      </Field>
      <Field label="Referral">
        <input
          className={fieldClass}
          defaultValue={client.referral ?? ""}
          list="client-referral-options"
          name="referral"
          placeholder="Who referred this client"
        />
        <datalist id="client-referral-options">
          {referralOptions.map((referral) => (
            <option key={referral} value={referral} />
          ))}
        </datalist>
      </Field>
      <Field label="IC / Business Reg. No.">
        <input
          className={fieldClass}
          defaultValue={client.business_registration_no ?? ""}
          name="business_registration_no"
          placeholder="IC for individual, reg no for company"
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
      <Field label="Main Address">
        <textarea
          className={`${fieldClass} min-h-24 py-2`}
          defaultValue={client.address ?? ""}
          name="address"
        />
      </Field>
      <section className="grid gap-3 rounded-xl border border-sky-100 bg-sky-50/40 p-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-sky-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-sky-700 shadow-sm">
            <MapPin className="h-4 w-4" />
          </span>
          Saved Addresses
        </h2>
        {clientAddresses.map((address) => (
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3" key={address.id}>
            <input name="address_id" type="hidden" value={address.id} />
            <Field label="Address Label">
              <input
                className={fieldClass}
                defaultValue={address.address_label ?? ""}
                name="address_label"
                placeholder="HQ, Shoplot, Warehouse, Home"
              />
            </Field>
            <Field label="Address">
              <textarea
                className={`${fieldClass} min-h-20 py-2`}
                defaultValue={address.address ?? ""}
                name="address_text"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                className="h-4 w-4"
                defaultChecked={Boolean(address.is_default)}
                name="default_address_id"
                type="radio"
                value={address.id}
              />
              Default address
            </label>
          </div>
        ))}
        <div className="grid gap-2 rounded-lg border border-dashed border-sky-200 bg-white/80 p-3">
          <p className="text-sm font-semibold text-slate-700">Add Address</p>
          <Field label="Address Label">
            <input
              className={fieldClass}
              name="new_address_label"
              placeholder="HQ, Shoplot, Warehouse, Home"
            />
          </Field>
          <Field label="Address">
            <textarea
              className={`${fieldClass} min-h-20 py-2`}
              name="new_address_text"
              placeholder="New saved address"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input className="h-4 w-4" name="default_address_id" type="radio" value="__new" />
            Default address
          </label>
        </div>
      </section>
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
