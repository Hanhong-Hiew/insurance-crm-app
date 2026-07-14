"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  updatePolicy,
  type UpdatePolicyState,
} from "@/app/protected/policies/[id]/edit/actions";

type OptionRow = {
  id: string;
  code?: string | null;
  name?: string | null;
  insurer_name?: string | null;
};

type PolicyTermRecord = {
  insurer_id: string | null;
  split_pattern_id: string | null;
  policy_number: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  primary_sum_assured: number | string | null;
  gross_premium: number | string | null;
  net_premium: number | string | null;
  premium_status: string | null;
  term_stage: string | null;
  quotation_status: string | null;
  policy_status: string | null;
  renewal_status: string | null;
  notes: string | null;
};

type EquipmentDetailRecord = {
  description: string | null;
  sum_insured: number | string | null;
};

type PolicyEditFormProps = {
  equipmentDetail: EquipmentDetailRecord | null;
  equipmentJson: Record<string, unknown>;
  insurers: OptionRow[];
  isEquipmentPolicy: boolean;
  policyTermId: string;
  splitPatterns: OptionRow[];
  term: PolicyTermRecord;
};

const fieldClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

function toDdMmYyyy(value: string | null | undefined) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function decimal(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "";
}

export function PolicyEditForm({
  equipmentDetail,
  equipmentJson,
  insurers,
  isEquipmentPolicy,
  policyTermId,
  splitPatterns,
  term,
}: PolicyEditFormProps) {
  const [state, formAction] = useActionState<UpdatePolicyState, FormData>(
    updatePolicy,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {state.error}
        </div>
      ) : null}
      {state.success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {state.success}
        </div>
      ) : null}

      <input name="policy_term_id" type="hidden" value={policyTermId} />
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-sky-100 bg-sky-50/50 px-4 py-3">
          <h1 className="font-semibold text-slate-800">Edit Policy Term</h1>
          <p className="text-xs text-slate-500">
            Update the policy term, premium, commission split, and risk details.
          </p>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Stage">
            <select className={fieldClass} defaultValue={term.term_stage ?? "policy"} name="term_stage">
              <option value="policy">Policy issued</option>
              <option value="quotation">Quotation only</option>
            </select>
          </Field>
          <Field label="Insurer">
            <select className={fieldClass} defaultValue={term.insurer_id ?? ""} name="insurer_id" required>
              <option value="">Select insurer</option>
              {insurers.map((insurer) => (
                <option key={insurer.id} value={insurer.id}>
                  {insurer.insurer_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Policy Number">
            <input className={fieldClass} defaultValue={term.policy_number ?? ""} name="policy_number" />
          </Field>
          <Field label="Effective Date">
            <input
              className={fieldClass}
              defaultValue={toDdMmYyyy(term.effective_date)}
              inputMode="numeric"
              name="effective_date"
              placeholder="dd/mm/yyyy"
              required
            />
          </Field>
          <Field label="Expiry Date">
            <input
              className={fieldClass}
              defaultValue={toDdMmYyyy(term.expiry_date)}
              inputMode="numeric"
              name="expiry_date"
              placeholder="dd/mm/yyyy"
              required
            />
          </Field>
          <Field label="Sum Assured">
            <input
              className={fieldClass}
              defaultValue={decimal(term.primary_sum_assured)}
              inputMode="decimal"
              name="primary_sum_assured"
            />
          </Field>
          <Field label="Gross Premium">
            <input
              className={fieldClass}
              defaultValue={decimal(term.gross_premium)}
              inputMode="decimal"
              name="gross_premium"
            />
          </Field>
          <Field label="Net Premium">
            <input
              className={fieldClass}
              defaultValue={decimal(term.net_premium)}
              inputMode="decimal"
              name="net_premium"
            />
          </Field>
          <Field label="Split Pattern">
            <select className={fieldClass} defaultValue={term.split_pattern_id ?? ""} name="split_pattern_id">
              <option value="">Select split pattern</option>
              {splitPatterns.map((pattern) => (
                <option key={pattern.id} value={pattern.id}>
                  {pattern.code} - {pattern.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Premium Status">
            <select className={fieldClass} defaultValue={term.premium_status ?? "unpaid"} name="premium_status">
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
          </Field>
          <Field label="Quotation Status">
            <select className={fieldClass} defaultValue={term.quotation_status ?? "draft"} name="quotation_status">
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="awaiting_client">Awaiting Client</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </Field>
          <Field label="Policy Status">
            <select className={fieldClass} defaultValue={term.policy_status ?? "active"} name="policy_status">
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="renewed">Renewed</option>
              <option value="lost">Lost</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
          <Field label="Renewal Status">
            <select className={fieldClass} defaultValue={term.renewal_status ?? "not_started"} name="renewal_status">
              <option value="not_started">Not Started</option>
              <option value="quoting">Quoting</option>
              <option value="quoted">Quoted</option>
              <option value="awaiting_client">Awaiting Client</option>
              <option value="confirmed">Confirmed</option>
              <option value="policy_issued">Policy Issued</option>
              <option value="lost">Lost</option>
            </select>
          </Field>
          <div className="md:col-span-2 xl:col-span-3">
            <Field label="Notes">
              <textarea
                className={`${fieldClass} min-h-28 py-2`}
                defaultValue={term.notes ?? ""}
                name="notes"
              />
            </Field>
          </div>
        </div>
      </section>

      {isEquipmentPolicy ? (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-sky-100 bg-sky-50/50 px-4 py-3">
            <h2 className="font-semibold text-slate-800">Equipment Details</h2>
            <p className="text-xs text-slate-500">
              Vehicle number, engine number, chassis number, and sum insured are saved on this equipment risk.
            </p>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Vehicle No">
              <input
                className={`${fieldClass} uppercase`}
                defaultValue={String(equipmentJson.vehicle_no ?? "")}
                name="equipment_vehicle_no"
                placeholder="Optional vehicle no"
              />
            </Field>
            <Field label="Equipment Description">
              <input
                className={fieldClass}
                defaultValue={equipmentDetail?.description ?? ""}
                name="equipment_description"
                placeholder="Equipment description"
              />
            </Field>
            <Field label="Make / Model">
              <input
                className={fieldClass}
                defaultValue={String(equipmentJson.make_model ?? "")}
                name="equipment_make_model"
                placeholder="Make or model"
              />
            </Field>
            <Field label="Year">
              <input
                className={fieldClass}
                defaultValue={String(equipmentJson.year ?? "")}
                inputMode="numeric"
                name="equipment_year"
                placeholder="2022"
              />
            </Field>
            <Field label="Engine No">
              <input
                className={fieldClass}
                defaultValue={String(equipmentJson.engine_no ?? "")}
                name="equipment_engine_no"
                placeholder="Engine number"
              />
            </Field>
            <Field label="Chassis No">
              <input
                className={fieldClass}
                defaultValue={String(equipmentJson.chassis_no ?? "")}
                name="equipment_chassis_no"
                placeholder="Chassis number"
              />
            </Field>
            <Field label="Equipment Sum Insured">
              <input
                className={fieldClass}
                defaultValue={decimal(equipmentDetail?.sum_insured)}
                inputMode="decimal"
                name="equipment_sum_insured"
                placeholder="0.00"
              />
            </Field>
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      disabled={pending}
      type="submit"
    >
      <Save className="h-4 w-4" />
      {pending ? "Saving..." : "Save Changes"}
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
