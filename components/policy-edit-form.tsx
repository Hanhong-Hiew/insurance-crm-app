"use client";

import {
  BadgeDollarSign,
  CalendarDays,
  Car,
  FileText,
  Landmark,
  MapPin,
  Plane,
  Save,
  ShieldCheck,
  Ship,
  Wrench,
} from "lucide-react";
import { useActionState, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  updatePolicy,
  type UpdatePolicyState,
} from "@/app/protected/policies/[id]/edit/actions";
import { ActionMessage } from "@/components/action-message";
import { CurrencyInput } from "@/components/currency-input";
import {
  calculateCommissionRows,
  toNumber,
  type CommissionRule,
} from "@/lib/commission";
import { formatPercent } from "@/lib/format";

type OptionRow = {
  id: string;
  code?: string | null;
  name?: string | null;
  insurer_name?: string | null;
};

type ClientAddressRow = {
  id: string;
  address: string | null;
  address_label: string | null;
  client_id: string | null;
  is_default: boolean | null;
};

type PolicyTermRecord = {
  client_address_id?: string | null;
  insurance_type_id?: string | null;
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

type ClientRecord = {
  address?: string | null;
  id: string;
  business_registration_no: string | null;
  client_name: string | null;
  client_type: string | null;
  email: string | null;
  phone: string | null;
  referral?: string | null;
};

type EquipmentDetailRecord = {
  description: string | null;
  detail_type?: string | null;
  details_json?: Record<string, unknown> | null;
};

type RiskDetailRecord = Record<string, unknown> | null;

type CommissionRateRow = {
  gross_commission_percent: number | string | null;
  insurance_type_id: string | null;
  net_commission_percent: number | string | null;
};

type SplitRuleRow = CommissionRule & {
  split_pattern_id: string;
};

type PolicyEditFormProps = {
  client: ClientRecord | null;
  clientAddresses: ClientAddressRow[];
  commissionRates: CommissionRateRow[];
  equipmentDetail: EquipmentDetailRecord | null;
  equipmentJson: Record<string, unknown>;
  fireDetail: RiskDetailRecord;
  genericDetail: RiskDetailRecord;
  insurers: OptionRow[];
  insuranceCode: string | null;
  insuranceTypes: OptionRow[];
  isEquipmentPolicy: boolean;
  marineDetail: RiskDetailRecord;
  motorDetail: RiskDetailRecord;
  policyTermId: string;
  primaryRiskLabel: string | null;
  splitPatterns: OptionRow[];
  splitRules: SplitRuleRow[];
  term: PolicyTermRecord;
  travelDetail: RiskDetailRecord;
};

const fieldClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

function toDdMmYyyy(value: string | null | undefined) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function normalizeDateText(value: string) {
  const raw = value.trim();
  if (!raw) return "";

  const match = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
  if (!match) return raw;

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const rawYear = match[3];
  const year =
    rawYear.length === 2
      ? Number(rawYear) >= 70
        ? `19${rawYear}`
        : `20${rawYear}`
      : rawYear;

  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCDate() !== Number(day) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCFullYear() !== Number(year)
  ) {
    return raw;
  }

  return `${day}/${month}/${year}`;
}

function displayToIso(value: string) {
  const normalized = normalizeDateText(value);
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function isoToDisplay(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function DateInput({
  name,
  onChange,
  required = false,
  value,
}: {
  name: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);

  function commit(nextValue: string) {
    onChange(normalizeDateText(nextValue));
  }

  return (
    <div className="flex h-10 overflow-hidden rounded-lg border border-slate-200 bg-white transition focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100">
      <input
        className="min-w-0 flex-1 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400"
        inputMode="numeric"
        name={name}
        onBlur={(event) => commit(event.target.value)}
        onChange={(event) => onChange(event.target.value)}
        placeholder="dd/mm/yyyy"
        required={required}
        type="text"
        value={value}
      />
      <button
        aria-label="Open calendar"
        className="relative flex w-10 items-center justify-center border-l border-sky-100 bg-sky-50 text-sky-700"
        onClick={() => pickerRef.current?.showPicker?.()}
        type="button"
      >
        <CalendarDays className="h-4 w-4" />
        <input
          aria-hidden="true"
          className="pointer-events-none absolute h-px w-px opacity-0"
          onChange={(event) => onChange(isoToDisplay(event.target.value))}
          ref={pickerRef}
          tabIndex={-1}
          type="date"
          value={displayToIso(value)}
        />
      </button>
    </div>
  );
}

function cleanCode(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function moneyText(value: number | string | null | undefined) {
  const amount = toNumber(value);
  if (!amount) return "-";
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function optionLabel(row: OptionRow) {
  return row.name || row.insurer_name || row.code || "-";
}

function detailText(record: RiskDetailRecord | Record<string, unknown>, key: string) {
  const value = record?.[key];
  if (value === null || value === undefined) return "";
  return String(value);
}

function isFireLike(code: string) {
  return code === "fire" || code === "home_insurance" || code === "industrial_all_risk";
}

function isEquipmentLike(code: string) {
  return code === "equipment_insurance" || code === "equipment_all_risk";
}

function TextInput({
  name,
  placeholder,
  record,
  required = false,
  uppercase = false,
}: {
  name: string;
  placeholder?: string;
  record: RiskDetailRecord | Record<string, unknown>;
  required?: boolean;
  uppercase?: boolean;
}) {
  return (
    <input
      className={`${fieldClass} ${uppercase ? "uppercase" : ""}`}
      defaultValue={detailText(record, name)}
      name={name}
      placeholder={placeholder}
      required={required}
    />
  );
}

function TextAreaInput({
  name,
  record,
}: {
  name: string;
  record: RiskDetailRecord | Record<string, unknown>;
}) {
  return (
    <textarea
      className={`${fieldClass} min-h-24 py-2`}
      defaultValue={detailText(record, name)}
      name={name}
    />
  );
}

export function PolicyEditForm({
  client,
  clientAddresses,
  commissionRates,
  equipmentDetail,
  equipmentJson,
  fireDetail,
  genericDetail,
  insurers,
  insuranceCode,
  insuranceTypes,
  isEquipmentPolicy,
  marineDetail,
  motorDetail,
  policyTermId,
  primaryRiskLabel,
  splitPatterns,
  splitRules,
  term,
  travelDetail,
}: PolicyEditFormProps) {
  const [state, formAction] = useActionState<UpdatePolicyState, FormData>(
    updatePolicy,
    {},
  );
  const [effectiveDate, setEffectiveDate] = useState(toDdMmYyyy(term.effective_date));
  const [expiryDate, setExpiryDate] = useState(toDdMmYyyy(term.expiry_date));
  const [grossPremium, setGrossPremium] = useState(String(term.gross_premium ?? ""));
  const [netPremium, setNetPremium] = useState(String(term.net_premium ?? ""));
  const [selectedTypeId, setSelectedTypeId] = useState(term.insurance_type_id ?? "");
  const [selectedSplitId, setSelectedSplitId] = useState(term.split_pattern_id ?? "");
  const initialClientAddress = clientAddresses.find(
    (address) => address.id === term.client_address_id,
  );
  const [selectedClientAddressId, setSelectedClientAddressId] = useState(
    initialClientAddress?.id ?? "",
  );
  const [clientAddressLabel, setClientAddressLabel] = useState(
    initialClientAddress?.address_label ?? "",
  );
  const [clientAddress, setClientAddress] = useState(
    initialClientAddress?.address ?? client?.address ?? "",
  );
  const [customCommission, setCustomCommission] = useState(false);
  const [customTotalAmount, setCustomTotalAmount] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const selectedInsuranceType = useMemo(
    () => insuranceTypes.find((type) => type.id === selectedTypeId),
    [insuranceTypes, selectedTypeId],
  );
  const code = cleanCode(selectedInsuranceType?.code ?? insuranceCode);
  const isMotor = code === "motor";
  const isFire = isFireLike(code);
  const isMarine = code === "marine_insurance";
  const isTravel = code === "travel";
  const selectedIsEquipmentPolicy = isEquipmentLike(code) || (!code && isEquipmentPolicy);
  const isGeneric = Boolean(code) && !isMotor && !isFire && !selectedIsEquipmentPolicy && !isMarine && !isTravel;
  const motorVehicle = motorDetail?.vehicles && typeof motorDetail.vehicles === "object"
    ? (motorDetail.vehicles as Record<string, unknown>)
    : {};
  const motorDefaults = {
    vehicle_no: detailText(motorDetail, "vehicle_no_snapshot") || detailText(motorVehicle, "vehicle_no"),
    motor_type: detailText(motorDetail, "motor_type"),
    type_of_cover: detailText(motorDetail, "type_of_cover") || "Comprehensive",
    ncd: detailText(motorDetail, "ncd"),
    make_model: detailText(motorVehicle, "make_model"),
    year_of_manufacture: detailText(motorVehicle, "year_of_manufacture"),
    engine_cc: detailText(motorVehicle, "engine_cc"),
    engine_no: detailText(motorVehicle, "engine_no"),
    chassis_no: detailText(motorVehicle, "chassis_no"),
    bdm: detailText(motorDetail, "bdm"),
    btm: detailText(motorDetail, "btm"),
    extra_coverage: detailText(motorDetail, "extra_coverage"),
    motor_description: detailText(motorDetail, "motor_description"),
  };
  const selectedClientAddresses = useMemo(
    () =>
      client?.id
        ? clientAddresses.filter((address) => address.client_id === client.id)
        : [],
    [client?.id, clientAddresses],
  );
  function applyClientAddress(address: ClientAddressRow | null, fallbackAddress = "") {
    setSelectedClientAddressId(address?.id ?? "");
    setClientAddressLabel(address?.address_label ?? "");
    setClientAddress(address?.address ?? fallbackAddress);
  }
  const selectedRate = commissionRates.find(
    (rate) => rate.insurance_type_id === selectedTypeId,
  );
  const selectedRules = splitRules.filter(
    (rule) => rule.split_pattern_id === selectedSplitId,
  );
  const commissionPreview = calculateCommissionRows({
    grossCommissionPercent: toNumber(selectedRate?.gross_commission_percent),
    grossPremium: toNumber(grossPremium),
    netCommissionPercent: toNumber(selectedRate?.net_commission_percent),
    rules: selectedRules,
  });
  const totalCommission = commissionPreview.reduce((sum, row) => {
    const amount = customCommission
      ? toNumber(customAmounts[row.payee_id] ?? row.amount)
      : row.amount;
    return sum + amount;
  }, 0);
  function distributeCustomTotal(value: string) {
    setCustomTotalAmount(value);
    const total = toNumber(value);
    if (!commissionPreview.length || !total) {
      setCustomAmounts({});
      return;
    }

    const autoTotal = commissionPreview.reduce((sum, row) => sum + row.amount, 0);
    const nextAmounts: Record<string, string> = {};
    let runningTotal = 0;
    commissionPreview.forEach((row, index) => {
      const isLast = index === commissionPreview.length - 1;
      const share = autoTotal ? row.amount / autoTotal : 1 / commissionPreview.length;
      const amount = isLast ? total - runningTotal : Math.round(total * share * 100) / 100;
      runningTotal += amount;
      nextAmounts[row.payee_id] = amount.toFixed(2);
    });
    setCustomAmounts(nextAmounts);
  }

  return (
    <form action={formAction} className="space-y-4">
      <ActionMessage message={state.error} tone="error" />
      <ActionMessage message={state.success} tone="success" />

      <input name="policy_term_id" type="hidden" value={policyTermId} />
      <section className="crm-card">
        <div className="crm-card-header">
          <h1 className="font-semibold text-slate-800">Client</h1>
          <p className="text-xs text-slate-500">
            These fields update the linked client record used by this policy.
          </p>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Client Name" required>
            <input
              className={fieldClass}
              defaultValue={client?.client_name ?? ""}
              name="client_name"
              required
            />
          </Field>
          <Field label="Client Type">
            <select className={fieldClass} defaultValue={client?.client_type ?? "individual"} name="client_type">
              <option value="individual">Individual</option>
              <option value="company">Company</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="IC / Business Reg. No.">
            <input
              className={fieldClass}
              defaultValue={client?.business_registration_no ?? ""}
              name="business_registration_no"
            />
          </Field>
          <Field label="Referral">
            <input
              className={fieldClass}
              defaultValue={client?.referral ?? ""}
              name="client_referral"
              placeholder="Who referred this client"
            />
          </Field>
          <Field label="Phone">
            <input className={fieldClass} defaultValue={client?.phone ?? ""} name="client_phone" />
          </Field>
          <Field label="Email">
            <input
              className={fieldClass}
              defaultValue={client?.email ?? ""}
              name="client_email"
              type="email"
            />
          </Field>
          <div className="md:col-span-2 xl:col-span-3">
            <FormSectionBlock icon={<MapPin className="h-4 w-4" />} title="Client Addresses">
              <Field label="Saved Address / Location">
                <select
                  className={fieldClass}
                  name="selected_client_address_id"
                  onChange={(event) => {
                    const addressId = event.target.value;
                    const address =
                      selectedClientAddresses.find((item) => item.id === addressId) ?? null;
                    applyClientAddress(address);
                  }}
                  value={selectedClientAddressId}
                >
                  <option value="">Add new address</option>
                  {selectedClientAddresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {address.address_label || address.address || "Saved address"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Address Label">
                <input
                  className={fieldClass}
                  name="client_address_label"
                  onChange={(event) => setClientAddressLabel(event.target.value)}
                  placeholder="HQ, Shoplot, Warehouse, Home"
                  value={clientAddressLabel}
                />
              </Field>
              <div className="md:col-span-2 xl:col-span-3">
                <Field label="Address">
                  <textarea
                    className={`${fieldClass} min-h-24 py-2`}
                    name="client_address"
                    onChange={(event) => setClientAddress(event.target.value)}
                    placeholder="Client or risk location address"
                    value={clientAddress}
                  />
                </Field>
              </div>
            </FormSectionBlock>
          </div>
        </div>
      </section>

      <section className="crm-card">
        <div className="crm-card-header">
          <h1 className="font-semibold text-slate-800">Risk & Stage</h1>
          <p className="text-xs text-slate-500">
            Risk controls which detail fields appear and which commission settings are used.
          </p>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Risk" required>
            <select
              className={fieldClass}
              name="insurance_type_id"
              onChange={(event) => {
                setSelectedTypeId(event.target.value);
                setCustomTotalAmount("");
                setCustomAmounts({});
              }}
              required
              value={selectedTypeId}
            >
              <option value="">Select risk</option>
              {insuranceTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {optionLabel(type)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stage">
            <select className={fieldClass} defaultValue={term.term_stage ?? "policy"} name="term_stage">
              <option value="policy">Policy issued</option>
              <option value="quotation">Quotation only</option>
            </select>
          </Field>
          <Field label="Insurer" required>
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
          {!isMotor ? (
            <Field label="Risk / Subject">
              <input
                className={fieldClass}
                defaultValue={primaryRiskLabel ?? ""}
                name="risk_label"
                placeholder="Property name, voyage, person, or insured item"
              />
            </Field>
          ) : null}
        </div>
      </section>

      <section className="crm-card">
        <div className="crm-card-header">
          <h1 className="font-semibold text-slate-800">Dates & Premium</h1>
          <p className="text-xs text-slate-500">
            These values drive renewals, payment follow-up, and commission calculation.
          </p>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Effective Date" required>
            <DateInput
              name="effective_date"
              onChange={setEffectiveDate}
              required
              value={effectiveDate}
            />
          </Field>
          <Field label="Expiry Date" required>
            <DateInput
              name="expiry_date"
              onChange={setExpiryDate}
              required
              value={expiryDate}
            />
          </Field>
          <Field label="Sum Assured">
            <CurrencyInput defaultValue={term.primary_sum_assured} name="primary_sum_assured" />
          </Field>
          <Field label="Gross Premium">
            <CurrencyInput
              name="gross_premium"
              onValueChange={setGrossPremium}
              value={grossPremium}
            />
          </Field>
          <Field label="Net Premium">
            <CurrencyInput
              name="net_premium"
              onValueChange={setNetPremium}
              value={netPremium}
            />
          </Field>
          <Field label="Split Pattern">
            <select
              className={fieldClass}
              name="split_pattern_id"
              onChange={(event) => {
                setSelectedSplitId(event.target.value);
                setCustomTotalAmount("");
                setCustomAmounts({});
              }}
              value={selectedSplitId}
            >
              <option value="">Select split pattern</option>
              {splitPatterns.map((pattern) => (
                <option key={pattern.id} value={pattern.id}>
                  {pattern.code}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="crm-card">
        <div className="crm-card-header">
          <h1 className="font-semibold text-slate-800">Status & Notes</h1>
          <p className="text-xs text-slate-500">
            Use this section for workflow state, not risk details.
          </p>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
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

      {isMotor ? <MotorRiskSection defaults={motorDefaults} /> : null}
      {isFire ? <FireRiskSection detail={fireDetail} selectedAddress={clientAddress} /> : null}
      {selectedIsEquipmentPolicy ? (
        <EquipmentRiskSection
          detail={equipmentDetail}
          detailsJson={equipmentJson}
        />
      ) : null}
      {isMarine ? <MarineRiskSection detail={marineDetail} /> : null}
      {isTravel ? <TravelRiskSection detail={travelDetail} /> : null}
      {isGeneric ? <GenericRiskSection detail={genericDetail} /> : null}

      <FormSection
        description="Auto-calculated from settings. Tick customize to override the RM amount for each payee."
        icon={<BadgeDollarSign className="h-5 w-5" />}
        title="Commission Preview"
      >
        <input
          name="custom_commission_enabled"
          type="hidden"
          value={customCommission ? "yes" : "no"}
        />
        <div className="rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2">
          <p className="text-xs font-semibold uppercase text-sky-700">Gross Rate</p>
          <p className="mt-1 text-sm font-semibold text-slate-950">
            {formatPercent(selectedRate?.gross_commission_percent)}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2">
          <p className="text-xs font-semibold uppercase text-emerald-700">Net Rate</p>
          <p className="mt-1 text-sm font-semibold text-slate-950">
            {formatPercent(selectedRate?.net_commission_percent)}
          </p>
        </div>
        <div className="rounded-lg border border-orange-100 bg-orange-50/60 px-3 py-2">
          <p className="text-xs font-semibold uppercase text-orange-700">Total</p>
          <p className="mt-1 text-sm font-semibold text-slate-950">
            {moneyText(totalCommission)}
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
          <input
            checked={customCommission}
            className="h-4 w-4 rounded border-slate-300"
            onChange={(event) => setCustomCommission(event.target.checked)}
            type="checkbox"
          />
          Customize commission
        </label>
        {customCommission ? (
          <div className="rounded-lg border border-violet-100 bg-violet-50/70 px-3 py-2 md:col-span-2 xl:col-span-3">
            <Field label="Custom Total Commission Amount">
              <CurrencyInput
                name="custom_total_commission_amount"
                onValueChange={distributeCustomTotal}
                placeholder="Override total commission"
                value={customTotalAmount}
              />
            </Field>
            <p className="mt-2 text-xs text-slate-500">
              This distributes the total across payees based on the selected split. You can still edit each payee amount below.
            </p>
          </div>
        ) : null}
        {commissionPreview.length ? (
          <div className="md:col-span-2 xl:col-span-3">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th className="px-3 py-2 font-semibold">Payee</th>
                    <th className="px-3 py-2 font-semibold">Auto Rate</th>
                    <th className="px-3 py-2 font-semibold">
                      {customCommission ? "Custom Amount" : "Auto Amount"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {commissionPreview.map((row) => (
                    <tr key={row.payee_id}>
                      <td className="px-3 py-2">
                        <input name="custom_commission_payee_id" type="hidden" value={row.payee_id} />
                        <input
                          name="custom_commission_percent"
                          type="hidden"
                          value={String(row.calculation_percent)}
                        />
                        {row.payee_name}
                      </td>
                      <td className="px-3 py-2">{formatPercent(row.calculation_percent)}</td>
                      <td className="px-3 py-2">
                        {customCommission ? (
                          <div className="grid gap-1">
                            <CurrencyInput
                              name="custom_commission_amount"
                              onValueChange={(value) =>
                                setCustomAmounts((current) => ({
                                  ...current,
                                  [row.payee_id]: value,
                                }))
                              }
                              value={customAmounts[row.payee_id] ?? String(row.amount)}
                            />
                            <span className="text-xs text-slate-500">
                              Auto: {moneyText(row.amount)}
                            </span>
                          </div>
                        ) : (
                          <>
                            <input name="custom_commission_amount" type="hidden" value={String(row.amount)} />
                            {moneyText(row.amount)}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 md:col-span-2 xl:col-span-3">
            Add premium and split pattern to preview commission.
          </p>
        )}
        {customCommission ? (
          <div className="md:col-span-2 xl:col-span-3">
            <Field label="Customization Reason">
              <textarea
                className={`${fieldClass} min-h-24 py-2`}
                name="custom_commission_reason"
                onChange={(event) => setCustomReason(event.target.value)}
                placeholder="Optional. Example: special case, rounded by insurer, Chelsea waived"
                value={customReason}
              />
            </Field>
          </div>
        ) : null}
      </FormSection>

      <div className="crm-panel flex flex-wrap items-center gap-3">
        <SubmitButton />
      </div>
    </form>
  );
}

function MotorRiskSection({
  defaults,
}: {
  defaults: Record<string, string>;
}) {
  return (
    <FormSection
      description="Stable vehicle fields are reused next year. Yearly values like NCD and BDM/BTM stay on this policy term."
      icon={<Car className="h-5 w-5" />}
      title="Motor Risk"
    >
      <Field label="Vehicle No" required>
        <input
          className={`${fieldClass} uppercase`}
          defaultValue={defaults.vehicle_no}
          name="vehicle_no"
          placeholder="QSJ6608"
          required
        />
      </Field>
      <Field label="Motor Type">
        <select className={fieldClass} defaultValue={defaults.motor_type} name="motor_type">
          <option value="">Select motor type</option>
          <option value="private">Private</option>
          <option value="company">Company</option>
          <option value="motorcycle">Motorcycle</option>
          <option value="permit_a">Permit A</option>
          <option value="permit_c">Permit C</option>
        </select>
      </Field>
      <Field label="Type of Cover">
        <select className={fieldClass} defaultValue={defaults.type_of_cover} name="type_of_cover">
          <option value="Comprehensive">Comprehensive</option>
          <option value="3rd Party, Fire and Theft">3rd Party, Fire and Theft</option>
          <option value="Third Party">Third Party</option>
        </select>
      </Field>
      <Field label="NCD">
        <input className={fieldClass} defaultValue={defaults.ncd} inputMode="decimal" name="ncd" placeholder="55%" />
      </Field>
      <Field label="Make / Model">
        <input className={fieldClass} defaultValue={defaults.make_model} name="make_model" placeholder="Toyota Hilux" />
      </Field>
      <Field label="Year of Manufacture">
        <input className={fieldClass} defaultValue={defaults.year_of_manufacture} inputMode="numeric" name="year_of_manufacture" placeholder="2022" />
      </Field>
      <Field label="Engine CC">
        <input className={fieldClass} defaultValue={defaults.engine_cc} inputMode="numeric" name="engine_cc" placeholder="2393" />
      </Field>
      <Field label="Engine No">
        <input className={fieldClass} defaultValue={defaults.engine_no} name="engine_no" placeholder="Engine number" />
      </Field>
      <Field label="Chassis No">
        <input className={fieldClass} defaultValue={defaults.chassis_no} name="chassis_no" placeholder="Chassis number" />
      </Field>
      <Field label="BDM">
        <input className={fieldClass} defaultValue={defaults.bdm} inputMode="decimal" name="bdm" placeholder="Optional" />
      </Field>
      <Field label="BTM">
        <input className={fieldClass} defaultValue={defaults.btm} inputMode="decimal" name="btm" placeholder="Optional" />
      </Field>
      <div className="md:col-span-2 xl:col-span-3">
        <Field label="Extra Coverage">
          <textarea
            className={`${fieldClass} min-h-24 py-2`}
            defaultValue={defaults.extra_coverage}
            name="extra_coverage"
          />
        </Field>
      </div>
      <div className="md:col-span-2 xl:col-span-3">
        <Field label="Motor Description">
          <textarea
            className={`${fieldClass} min-h-24 py-2`}
            defaultValue={defaults.motor_description}
            name="motor_description"
          />
        </Field>
      </div>
    </FormSection>
  );
}

function FireRiskSection({
  detail,
  selectedAddress,
}: {
  detail: RiskDetailRecord;
  selectedAddress: string;
}) {
  const address =
    detailText(detail, "property_address") || detailText(detail, "risk_location") || selectedAddress;

  return (
    <FormSection
      description="Fire-like policies use the main term sum assured. Keep this section for risk details only."
      icon={<Landmark className="h-5 w-5" />}
      title="Fire Risk"
    >
      <Field label="Risk Location / Property Address">
        <input
          className={fieldClass}
          defaultValue={address}
          name="property_address"
          placeholder="Insured property or risk location"
        />
      </Field>
      <Field label="Occupation">
        <TextInput name="occupation" placeholder="Shop, warehouse, residence" record={detail} />
      </Field>
      <Field label="Construction Class">
        <select
          className={fieldClass}
          defaultValue={detailText(detail, "construction_type")}
          name="construction_type"
        >
          <option value="">Select construction class</option>
          <option value="C1A">C1A</option>
          <option value="C1B">C1B</option>
          <option value="C2">C2</option>
        </select>
      </Field>
    </FormSection>
  );
}

function EquipmentRiskSection({
  detail,
  detailsJson,
}: {
  detail: EquipmentDetailRecord | null;
  detailsJson: Record<string, unknown>;
}) {
  return (
    <FormSection
      description="Equipment policies track machine identity separately from policy values."
      icon={<Wrench className="h-5 w-5" />}
      title="Equipment Risk"
    >
      <Field label="Vehicle No">
        <TextInput name="equipment_vehicle_no" placeholder="Optional vehicle no" record={{ equipment_vehicle_no: detailsJson.vehicle_no }} uppercase />
      </Field>
      <Field label="Equipment Description">
        <input
          className={fieldClass}
          defaultValue={detail?.description ?? ""}
          name="equipment_description"
          placeholder="Equipment description"
        />
      </Field>
      <Field label="Make / Model">
        <TextInput name="equipment_make_model" placeholder="Make or model" record={{ equipment_make_model: detailsJson.make_model }} />
      </Field>
      <Field label="Year">
        <TextInput name="equipment_year" placeholder="2022" record={{ equipment_year: detailsJson.year }} />
      </Field>
      <Field label="Engine No">
        <TextInput name="equipment_engine_no" placeholder="Engine number" record={{ equipment_engine_no: detailsJson.engine_no }} />
      </Field>
      <Field label="Chassis No">
        <TextInput name="equipment_chassis_no" placeholder="Chassis number" record={{ equipment_chassis_no: detailsJson.chassis_no }} />
      </Field>
    </FormSection>
  );
}

function MarineRiskSection({ detail }: { detail: RiskDetailRecord }) {
  return (
    <FormSection
      description="Marine policies track the shipment or voyage details separately."
      icon={<Ship className="h-5 w-5" />}
      title="Marine Risk"
    >
      <Field label="Marine Type">
        <TextInput name="marine_type" placeholder="Cargo, hull, open cover" record={detail} />
      </Field>
      <Field label="Voyage From">
        <TextInput name="voyage_from" placeholder="Origin" record={detail} />
      </Field>
      <Field label="Voyage To">
        <TextInput name="voyage_to" placeholder="Destination" record={detail} />
      </Field>
      <Field label="Goods Description">
        <TextInput name="goods_description" placeholder="Goods description" record={detail} />
      </Field>
    </FormSection>
  );
}

function TravelRiskSection({ detail }: { detail: RiskDetailRecord }) {
  return (
    <FormSection
      description="Travel policies use the term dates above. Add destination and traveller details here."
      icon={<Plane className="h-5 w-5" />}
      title="Travel Risk"
    >
      <Field label="Destination">
        <TextInput name="destination" placeholder="Destination" record={detail} />
      </Field>
      <Field label="Pax">
        <TextInput name="pax" placeholder="1" record={detail} />
      </Field>
      <Field label="Plan Name">
        <TextInput name="plan_name" placeholder="Plan name" record={detail} />
      </Field>
    </FormSection>
  );
}

function GenericRiskSection({ detail }: { detail: RiskDetailRecord }) {
  return (
    <FormSection
      description="Use this for PA, liability, machinery, and other non-motor policies."
      icon={<ShieldCheck className="h-5 w-5" />}
      title="Other Risk"
    >
      <Field label="Detail Type">
        <TextInput name="generic_detail_type" placeholder="Liability, machinery, PA, etc." record={{ generic_detail_type: detailText(detail, "detail_type") }} />
      </Field>
      <div className="md:col-span-2 xl:col-span-3">
        <Field label="Description">
          <TextAreaInput name="generic_description" record={{ generic_description: detailText(detail, "description") }} />
        </Field>
      </div>
    </FormSection>
  );
}

function FormSection({
  children,
  description,
  icon,
  title,
}: {
  children: React.ReactNode;
  description: string;
  icon?: React.ReactNode;
  title: string;
}) {
  return (
    <section className="crm-card">
      <div className="crm-card-header">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sky-700 shadow-sm">
            {icon ?? <FileText className="h-5 w-5" />}
          </span>
          {title}
        </h2>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function FormSectionBlock({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="grid gap-4 rounded-xl border border-sky-100 bg-sky-50/40 p-3 md:grid-cols-2 xl:grid-cols-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-sky-800 md:col-span-2 xl:col-span-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-sky-700 shadow-sm">
          {icon}
        </span>
        {title}
      </div>
      {children}
    </div>
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
  required = false,
}: {
  children: React.ReactNode;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      <span>
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}
