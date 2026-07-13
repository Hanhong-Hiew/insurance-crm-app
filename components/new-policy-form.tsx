"use client";

import { useActionState, useMemo, useState } from "react";
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

function typeCode(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function isFireLike(code: string) {
  return code === "fire" || code === "home_insurance" || code === "industrial_all_risk";
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
  const [selectedTypeId, setSelectedTypeId] = useState("");

  const selectedType = useMemo(
    () => insuranceTypes.find((type) => type.id === selectedTypeId),
    [insuranceTypes, selectedTypeId],
  );
  const selectedCode = typeCode(selectedType?.code);
  const isMotor = selectedCode === "motor";
  const isFire = isFireLike(selectedCode);
  const isMarine = selectedCode === "marine_insurance";
  const isTravel = selectedCode === "travel";
  const showGenericRisk = selectedCode && !isMotor && !isFire && !isMarine && !isTravel;

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
        description="Choose or type the client name. Existing clients appear as suggestions."
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
        description="This decides which risk fields appear and which settings are used for commission."
        title="Policy"
      >
        <Field label="Insurance Type">
          <select
            className={fieldClass}
            name="insurance_type_id"
            onChange={(event) => setSelectedTypeId(event.target.value)}
            required
            value={selectedTypeId}
          >
            <option value="">Select insurance type</option>
            {insuranceTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {optionLabel(type)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Stage">
          <select className={fieldClass} name="term_stage" required>
            <option value="policy">Policy issued</option>
            <option value="quotation">Quotation only</option>
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

        {!isMotor ? (
          <Field label="Risk Label">
            <input
              className={fieldClass}
              name="risk_label"
              placeholder="Property, voyage, person, or short risk label"
            />
          </Field>
        ) : null}
      </FormSection>

      <FormSection
        description="Dates drive renewals and follow-up work. Use dd/mm/yyyy."
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

      {isMotor ? <MotorRiskSection /> : null}
      {isFire ? <FireRiskSection /> : null}
      {isMarine ? <MarineRiskSection /> : null}
      {isTravel ? <TravelRiskSection /> : null}
      {showGenericRisk ? <GenericRiskSection /> : null}

      <FormSection
        description="Commission is calculated from settings after selecting the split pattern."
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
        description="Internal notes for details that do not belong in structured fields yet."
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
          Saves client, yearly policy term, risk details, sum assured, and commission rows.
        </p>
      </div>
    </form>
  );
}

function MotorRiskSection() {
  return (
    <FormSection
      description="Stable vehicle fields are reused next year. Yearly values like NCD and BDM/BTM stay on this policy term."
      title="Motor Risk"
    >
      <Field label="Vehicle No">
        <input
          className={`${fieldClass} uppercase`}
          name="vehicle_no"
          placeholder="QSJ6608"
          required
        />
      </Field>
      <Field label="Motor Type">
        <select className={fieldClass} name="motor_type">
          <option value="">Select motor type</option>
          <option value="private">Private</option>
          <option value="company">Company</option>
          <option value="permit_a">Permit A</option>
          <option value="permit_c">Permit C</option>
        </select>
      </Field>
      <Field label="NCD">
        <input className={fieldClass} inputMode="decimal" name="ncd" placeholder="55%" />
      </Field>
      <Field label="Make / Model">
        <input className={fieldClass} name="make_model" placeholder="Toyota Hilux" />
      </Field>
      <Field label="Year of Manufacture">
        <input className={fieldClass} inputMode="numeric" name="year_of_manufacture" placeholder="2022" />
      </Field>
      <Field label="Engine CC">
        <input className={fieldClass} inputMode="numeric" name="engine_cc" placeholder="2393" />
      </Field>
      <Field label="Engine No">
        <input className={fieldClass} name="engine_no" placeholder="Engine number" />
      </Field>
      <Field label="Chassis No">
        <input className={fieldClass} name="chassis_no" placeholder="Chassis number" />
      </Field>
      <Field label="BDM">
        <MoneyInput name="bdm" placeholder="0.00" />
      </Field>
      <Field label="BTM">
        <MoneyInput name="btm" placeholder="0.00" />
      </Field>
      <div className="md:col-span-2 xl:col-span-3">
        <Field label="Extra Coverage">
          <textarea className={`${fieldClass} min-h-24 py-2`} name="extra_coverage" />
        </Field>
      </div>
      <div className="md:col-span-2 xl:col-span-3">
        <Field label="Motor Description">
          <textarea className={`${fieldClass} min-h-24 py-2`} name="motor_description" />
        </Field>
      </div>
    </FormSection>
  );
}

function FireRiskSection() {
  return (
    <FormSection description="Fire-like policies need location and insured value breakdown." title="Fire Risk">
      <Field label="Property Address">
        <input className={fieldClass} name="property_address" placeholder="Property address" />
      </Field>
      <Field label="Risk Location">
        <input className={fieldClass} name="risk_location" placeholder="Risk location" />
      </Field>
      <Field label="Occupation">
        <input className={fieldClass} name="occupation" placeholder="Shop, warehouse, residence" />
      </Field>
      <Field label="Construction Type">
        <input className={fieldClass} name="construction_type" placeholder="Concrete, timber, mixed" />
      </Field>
      <Field label="Building Sum Insured">
        <MoneyInput name="building_sum_insured" placeholder="0.00" />
      </Field>
      <Field label="Contents Sum Insured">
        <MoneyInput name="contents_sum_insured" placeholder="0.00" />
      </Field>
      <Field label="Stock Sum Insured">
        <MoneyInput name="stock_sum_insured" placeholder="0.00" />
      </Field>
    </FormSection>
  );
}

function MarineRiskSection() {
  return (
    <FormSection description="Marine policies track the shipment or voyage details separately." title="Marine Risk">
      <Field label="Marine Type">
        <input className={fieldClass} name="marine_type" placeholder="Cargo, hull, open cover" />
      </Field>
      <Field label="Voyage From">
        <input className={fieldClass} name="voyage_from" placeholder="Origin" />
      </Field>
      <Field label="Voyage To">
        <input className={fieldClass} name="voyage_to" placeholder="Destination" />
      </Field>
      <Field label="Goods Description">
        <input className={fieldClass} name="goods_description" placeholder="Goods description" />
      </Field>
      <Field label="Marine Sum Insured">
        <MoneyInput name="marine_sum_insured" placeholder="0.00" />
      </Field>
    </FormSection>
  );
}

function TravelRiskSection() {
  return (
    <FormSection description="Travel policies need trip period and destination details." title="Travel Risk">
      <Field label="Destination">
        <input className={fieldClass} name="destination" placeholder="Destination" />
      </Field>
      <Field label="Travel Start Date">
        <input className={fieldClass} inputMode="numeric" name="travel_start_date" placeholder="dd/mm/yyyy" />
      </Field>
      <Field label="Travel End Date">
        <input className={fieldClass} inputMode="numeric" name="travel_end_date" placeholder="dd/mm/yyyy" />
      </Field>
      <Field label="Pax">
        <input className={fieldClass} inputMode="numeric" name="pax" placeholder="1" />
      </Field>
      <Field label="Plan Name">
        <input className={fieldClass} name="plan_name" placeholder="Plan name" />
      </Field>
    </FormSection>
  );
}

function GenericRiskSection() {
  return (
    <FormSection description="Use this for PA, liability, machinery, equipment, and other non-motor policies." title="Other Risk">
      <Field label="Detail Type">
        <input className={fieldClass} name="generic_detail_type" placeholder="Liability, machinery, PA, etc." />
      </Field>
      <Field label="Generic Sum Insured">
        <MoneyInput name="generic_sum_insured" placeholder="0.00" />
      </Field>
      <div className="md:col-span-2 xl:col-span-3">
        <Field label="Description">
          <textarea className={`${fieldClass} min-h-24 py-2`} name="generic_description" />
        </Field>
      </div>
    </FormSection>
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
