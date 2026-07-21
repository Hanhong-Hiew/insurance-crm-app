"use client";

import {
  BadgeDollarSign,
  CalendarDays,
  Car,
  FileText,
  Landmark,
  Plane,
  RefreshCcw,
  Ship,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { savePolicy, type SavePolicyState } from "@/app/protected/new-policy/actions";
import { ActionMessage } from "@/components/action-message";
import { CurrencyInput } from "@/components/currency-input";
import {
  calculateCommissionRows,
  toNumber,
  type CommissionRule,
} from "@/lib/commission";

type OptionRow = {
  id: string;
  address?: string | null;
  name?: string | null;
  client_name?: string | null;
  business_registration_no?: string | null;
  client_type?: string | null;
  referral?: string | null;
  phone?: string | null;
  email?: string | null;
  insurer_name?: string | null;
  code?: string | null;
};

type CommissionRateRow = {
  gross_commission_percent: number | string | null;
  insurance_type_id: string | null;
  net_commission_percent: number | string | null;
};

type SplitRuleRow = CommissionRule & {
  split_pattern_id: string;
};

type NewPolicyFormProps = {
  clients: OptionRow[];
  commissionRates: CommissionRateRow[];
  insuranceTypes: OptionRow[];
  insurers: OptionRow[];
  splitRules: SplitRuleRow[];
  splitPatterns: OptionRow[];
};

const fieldClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

function optionLabel(row: OptionRow) {
  return row.name || row.client_name || row.insurer_name || row.code || "-";
}

function clientSearchText(row: OptionRow) {
  return `${row.client_name ?? ""} ${row.business_registration_no ?? ""} ${row.referral ?? ""} ${row.phone ?? ""} ${row.email ?? ""}`.toLowerCase();
}

function typeCode(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function isFireLike(code: string) {
  return code === "fire" || code === "home_insurance" || code === "industrial_all_risk";
}

function isEquipmentLike(code: string) {
  return code === "equipment_insurance" || code === "equipment_all_risk";
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

function oneYearExpiry(value: string) {
  const iso = displayToIso(value);
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  date.setUTCDate(date.getUTCDate() - 1);
  return isoToDisplay(date.toISOString().slice(0, 10));
}

function DateInput({
  name,
  onChange,
  onFormatted,
  placeholder = "dd/mm/yyyy",
  required = false,
  value,
}: {
  name: string;
  onChange: (value: string) => void;
  onFormatted?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);

  function commit(nextValue: string) {
    const formatted = normalizeDateText(nextValue);
    onChange(formatted);
    onFormatted?.(formatted);
  }

  return (
    <div className="flex h-10 overflow-hidden rounded-lg border border-slate-200 bg-white transition focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100">
      <input
        className="min-w-0 flex-1 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400"
        inputMode="numeric"
        name={name}
        onBlur={(event) => commit(event.target.value)}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
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
          onChange={(event) => {
            const display = isoToDisplay(event.target.value);
            onChange(display);
            onFormatted?.(display);
          }}
          ref={pickerRef}
          tabIndex={-1}
          type="date"
          value={displayToIso(value)}
        />
      </button>
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
  commissionRates,
  insuranceTypes,
  insurers,
  splitRules,
  splitPatterns,
}: NewPolicyFormProps) {
  const [state, formAction] = useActionState<SavePolicyState, FormData>(
    savePolicy,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [clientName, setClientName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [businessRegistrationNo, setBusinessRegistrationNo] = useState("");
  const [clientType, setClientType] = useState("individual");
  const [clientReferral, setClientReferral] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [selectedSplitId, setSelectedSplitId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [expiryTouched, setExpiryTouched] = useState(false);
  const [grossPremium, setGrossPremium] = useState("");
  const [netPremium, setNetPremium] = useState("");
  const [customCommission, setCustomCommission] = useState(false);
  const [customTotalAmount, setCustomTotalAmount] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  function resetForm() {
    formRef.current?.reset();
    setClientName("");
    setSelectedClientId("");
    setBusinessRegistrationNo("");
    setClientType("individual");
    setClientReferral("");
    setClientPhone("");
    setClientEmail("");
    setClientAddress("");
    setShowClientSuggestions(false);
    setSelectedTypeId("");
    setSelectedSplitId("");
    setEffectiveDate("");
    setExpiryDate("");
    setExpiryTouched(false);
    setGrossPremium("");
    setNetPremium("");
    setCustomCommission(false);
    setCustomTotalAmount("");
    setCustomReason("");
    setCustomAmounts({});
  }

  useEffect(() => {
    if (state.success) resetForm();
  }, [state.success]);

  const selectedType = useMemo(
    () => insuranceTypes.find((type) => type.id === selectedTypeId),
    [insuranceTypes, selectedTypeId],
  );
  const selectedRate = useMemo(
    () => commissionRates.find((rate) => rate.insurance_type_id === selectedTypeId),
    [commissionRates, selectedTypeId],
  );
  const selectedRules = useMemo(
    () => splitRules.filter((rule) => rule.split_pattern_id === selectedSplitId),
    [selectedSplitId, splitRules],
  );
  const commissionPreview = useMemo(
    () =>
      calculateCommissionRows({
        grossPremium: toNumber(grossPremium),
        netCommissionPercent: toNumber(selectedRate?.net_commission_percent),
        netPremium: toNumber(netPremium),
        rules: selectedRules,
      }),
    [grossPremium, netPremium, selectedRate?.net_commission_percent, selectedRules],
  );
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
  const selectedCode = typeCode(selectedType?.code);
  const isMotor = selectedCode === "motor";
  const isFire = isFireLike(selectedCode);
  const isEquipment = isEquipmentLike(selectedCode);
  const isMarine = selectedCode === "marine_insurance";
  const isTravel = selectedCode === "travel";
  const showGenericRisk =
    selectedCode && !isMotor && !isFire && !isEquipment && !isMarine && !isTravel;
  const clientSuggestions = useMemo(() => {
    const q = clientName.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);
    return clients
      .filter((client) => clientSearchText(client).includes(q))
      .slice(0, 8);
  }, [clientName, clients]);
  const referralOptions = useMemo(
    () =>
      Array.from(
        new Set(
          clients
            .map((client) => client.referral?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })),
    [clients],
  );

  return (
    <form action={formAction} className="space-y-4" ref={formRef}>
      <ActionMessage message={state.error} tone="error" />
      <ActionMessage message={state.success} tone="success" />
      <ActionMessage message={state.warning} tone="warning" />

      <FormSection
        description="Choose an existing client or create a new one while saving the policy."
        title="Client"
      >
        <input name="selected_client_id" type="hidden" value={selectedClientId} />
        <Field label="Client Name" required>
          <div className="relative">
            <input
              autoComplete="off"
              className={fieldClass}
              name="client_name"
              onBlur={() => {
                window.setTimeout(() => setShowClientSuggestions(false), 120);
              }}
              onChange={(event) => {
                setClientName(event.target.value);
                setSelectedClientId("");
                setShowClientSuggestions(true);
              }}
              onFocus={() => setShowClientSuggestions(true)}
              placeholder="Type existing client or new client name"
              required
              value={clientName}
            />
            {showClientSuggestions && clientSuggestions.length ? (
              <div className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-sky-200 bg-white shadow-lg">
                {clientSuggestions.map((client) => (
                  <button
                    className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-800 last:border-b-0 hover:bg-sky-50"
                    key={client.id}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setSelectedClientId(client.id);
                      setClientName(client.client_name ?? "");
                      setBusinessRegistrationNo(client.business_registration_no ?? "");
                      setClientType(client.client_type ?? "individual");
                      setClientReferral(client.referral ?? "");
                      setClientPhone(client.phone ?? "");
                      setClientEmail(client.email ?? "");
                      setClientAddress(client.address ?? "");
                      setShowClientSuggestions(false);
                    }}
                    type="button"
                  >
                    <span className="block font-semibold text-slate-900">
                      {client.client_name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {client.business_registration_no || "No IC / business reg no"}
                      {client.phone ? ` / ${client.phone}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </Field>
        <Field label="Client Type">
          <select
            className={fieldClass}
            name="client_type"
            onChange={(event) => setClientType(event.target.value)}
            value={clientType}
          >
            <option value="individual">Individual</option>
            <option value="company">Company</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Referral">
          <input
            className={fieldClass}
            list="client-referral-options"
            name="client_referral"
            onChange={(event) => setClientReferral(event.target.value)}
            placeholder="Who referred this client"
            value={clientReferral}
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
            name="business_registration_no"
            onChange={(event) => setBusinessRegistrationNo(event.target.value)}
            placeholder="IC for individual, reg no for company"
            value={businessRegistrationNo}
          />
        </Field>
        <Field label="Phone">
          <input
            className={fieldClass}
            name="client_phone"
            onChange={(event) => setClientPhone(event.target.value)}
            placeholder="Phone number"
            value={clientPhone}
          />
        </Field>
        <Field label="Email">
          <input
            className={fieldClass}
            name="client_email"
            onChange={(event) => setClientEmail(event.target.value)}
            placeholder="Email"
            type="email"
            value={clientEmail}
          />
        </Field>
        <div className="md:col-span-2 xl:col-span-3">
          <Field label="Address">
            <textarea
              className={`${fieldClass} min-h-24 py-2`}
              name="client_address"
              onChange={(event) => setClientAddress(event.target.value)}
              placeholder="Client address"
              value={clientAddress}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        description="This decides which risk fields appear and which settings are used for commission."
        title="Policy"
      >
        <Field label="Insurance Type" required>
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

        <Field label="Stage" required>
          <select className={fieldClass} name="term_stage" required>
            <option value="policy">Policy issued</option>
            <option value="quotation">Quotation only</option>
          </select>
        </Field>

        <Field label="Insurer" required>
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
          <Field label="Risk / Subject">
            <input
              className={fieldClass}
              name="risk_label"
              placeholder="Property name, voyage, person, or insured item"
            />
          </Field>
        ) : null}
      </FormSection>

      <FormSection
        description="Dates drive renewals and follow-up work. Use dd/mm/yyyy."
        title="Term"
      >
        <Field label="Effective Date" required>
          <DateInput
            name="effective_date"
            onChange={setEffectiveDate}
            onFormatted={(value) => {
              if (!expiryTouched) setExpiryDate(oneYearExpiry(value));
            }}
            required
            value={effectiveDate}
          />
        </Field>

        <Field label="Expiry Date" required>
          <DateInput
            name="expiry_date"
            onChange={(value) => {
              setExpiryTouched(true);
              setExpiryDate(value);
            }}
            required
            value={expiryDate}
          />
        </Field>

        <Field label="Sum Assured">
          <CurrencyInput name="primary_sum_assured" />
        </Field>
      </FormSection>

      {isMotor ? <MotorRiskSection /> : null}
      {isFire ? <FireRiskSection /> : null}
      {isEquipment ? <EquipmentRiskSection /> : null}
      {isMarine ? <MarineRiskSection /> : null}
      {isTravel ? <TravelRiskSection /> : null}
      {showGenericRisk ? <GenericRiskSection /> : null}

      <FormSection
        description="Commission is calculated from settings after selecting the split pattern."
        title="Premium & Commission"
      >
        <Field label="Gross Premium" required>
          <CurrencyInput
            name="gross_premium"
            onValueChange={setGrossPremium}
            required
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
                {pattern.code} - {pattern.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Premium Status">
          <select className={fieldClass} defaultValue="unpaid" name="premium_status">
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        </Field>
      </FormSection>

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
            {selectedRate ? `${(toNumber(selectedRate.gross_commission_percent) * 100).toFixed(2)}%` : "-"}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2">
          <p className="text-xs font-semibold uppercase text-emerald-700">Net Rate</p>
          <p className="mt-1 text-sm font-semibold text-slate-950">
            {selectedRate ? `${(toNumber(selectedRate.net_commission_percent) * 100).toFixed(2)}%` : "-"}
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
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
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
                    <tr className="border-t border-slate-100" key={row.payee_id}>
                      <td className="px-3 py-2">
                        <input name="custom_commission_payee_id" type="hidden" value={row.payee_id} />
                        <input
                          name="custom_commission_percent"
                          type="hidden"
                          value={String(row.calculation_percent)}
                        />
                        {row.payee_name}
                      </td>
                      <td className="px-3 py-2">{(row.calculation_percent * 100).toFixed(2)}%</td>
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
            Select insurance type, premium, and split pattern to preview commission.
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
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-white px-4 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50"
          onClick={resetForm}
          type="button"
        >
          <RefreshCcw className="h-4 w-4" />
          Start New Policy
        </button>
        <p className="text-sm text-slate-500">
          Saves client, yearly policy term, risk details, sum assured, and commission rows.
        </p>
      </div>
    </form>
  );
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

function MotorRiskSection() {
  return (
    <FormSection
      description="Stable vehicle fields are reused next year. Yearly values like NCD and BDM/BTM stay on this policy term."
      icon={<Car className="h-5 w-5" />}
      title="Motor Risk"
    >
      <Field label="Vehicle No" required>
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
      <Field label="Type of Cover">
        <select className={fieldClass} defaultValue="Comprehensive" name="type_of_cover">
          <option value="Comprehensive">Comprehensive</option>
          <option value="3rd Party, Fire and Theft">3rd Party, Fire and Theft</option>
          <option value="Third Party">Third Party</option>
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
        <input className={fieldClass} inputMode="decimal" name="bdm" placeholder="Optional" />
      </Field>
      <Field label="BTM">
        <input className={fieldClass} inputMode="decimal" name="btm" placeholder="Optional" />
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
    <FormSection
      description="Fire-like policies use the main term sum assured. Keep this section for risk details only."
      icon={<Landmark className="h-5 w-5" />}
      title="Fire Risk"
    >
      <Field label="Risk Location / Property Address">
        <input className={fieldClass} name="property_address" placeholder="Insured property or risk location" />
      </Field>
      <Field label="Occupation">
        <input className={fieldClass} name="occupation" placeholder="Shop, warehouse, residence" />
      </Field>
      <Field label="Construction Class">
        <select className={fieldClass} name="construction_type">
          <option value="">Select construction class</option>
          <option value="C1A">C1A</option>
          <option value="C1B">C1B</option>
          <option value="C2">C2</option>
        </select>
      </Field>
    </FormSection>
  );
}

function EquipmentRiskSection() {
  return (
    <FormSection
      description="Equipment policies track machine identity separately from policy values."
      icon={<Wrench className="h-5 w-5" />}
      title="Equipment Risk"
    >
      <Field label="Vehicle No">
        <input className={`${fieldClass} uppercase`} name="equipment_vehicle_no" placeholder="Optional vehicle no" />
      </Field>
      <Field label="Equipment Description">
        <input className={fieldClass} name="generic_description" placeholder="Equipment description" />
      </Field>
      <Field label="Make / Model">
        <input className={fieldClass} name="equipment_make_model" placeholder="Make or model" />
      </Field>
      <Field label="Year">
        <input className={fieldClass} inputMode="numeric" name="equipment_year" placeholder="2022" />
      </Field>
      <Field label="Engine No">
        <input className={fieldClass} name="equipment_engine_no" placeholder="Engine number" />
      </Field>
      <Field label="Chassis No">
        <input className={fieldClass} name="equipment_chassis_no" placeholder="Chassis number" />
      </Field>
    </FormSection>
  );
}

function MarineRiskSection() {
  return (
    <FormSection
      description="Marine policies track the shipment or voyage details separately."
      icon={<Ship className="h-5 w-5" />}
      title="Marine Risk"
    >
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
    </FormSection>
  );
}

function TravelRiskSection() {
  return (
    <FormSection
      description="Travel policies use the term dates above. Add destination and traveller details here."
      icon={<Plane className="h-5 w-5" />}
      title="Travel Risk"
    >
      <Field label="Destination">
        <input className={fieldClass} name="destination" placeholder="Destination" />
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
    <FormSection
      description="Use this for PA, liability, machinery, and other non-motor policies."
      icon={<ShieldCheck className="h-5 w-5" />}
      title="Other Risk"
    >
      <Field label="Detail Type">
        <input className={fieldClass} name="generic_detail_type" placeholder="Liability, machinery, PA, etc." />
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
  icon,
  title,
}: {
  children: React.ReactNode;
  description: string;
  icon?: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white/95 shadow-sm">
      <div className="border-b border-sky-100 bg-sky-50/50 px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sky-700 shadow-sm">
            {icon ?? <FileText className="h-5 w-5" />}
          </span>
          {title}
        </h2>
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
