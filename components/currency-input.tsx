"use client";

type CurrencyInputProps = {
  defaultValue?: number | string | null;
  name: string;
  placeholder?: string;
  required?: boolean;
};

const inputClass =
  "min-w-0 flex-1 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400";

function normalizeMoneyText(value: string) {
  const cleaned = value.replace(/rm/gi, "").replace(/[^\d.]/g, "");
  const [whole = "", ...decimalParts] = cleaned.split(".");
  const decimal = decimalParts.join("").slice(0, 2);
  return decimalParts.length ? `${whole}.${decimal}` : whole;
}

function formatMoneyText(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  const normalized = normalizeMoneyText(String(value));
  if (!normalized) return "";

  const [whole, decimal] = normalized.split(".");
  const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimal !== undefined ? `${formattedWhole}.${decimal}` : formattedWhole;
}

export function CurrencyInput({
  defaultValue,
  name,
  placeholder = "0.00",
  required = false,
}: CurrencyInputProps) {
  return (
    <div className="flex h-10 overflow-hidden rounded-lg border border-slate-200 bg-white transition focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100">
      <span className="flex items-center border-r border-sky-100 bg-sky-50 px-3 text-sm font-semibold text-sky-700">
        RM
      </span>
      <input
        className={inputClass}
        defaultValue={formatMoneyText(defaultValue)}
        inputMode="decimal"
        name={name}
        onBlur={(event) => {
          event.currentTarget.value = formatMoneyText(event.currentTarget.value);
        }}
        onChange={(event) => {
          event.currentTarget.value = normalizeMoneyText(event.currentTarget.value);
        }}
        onFocus={(event) => {
          event.currentTarget.value = normalizeMoneyText(event.currentTarget.value);
        }}
        pattern="[0-9,]+([.][0-9]{0,2})?"
        placeholder={placeholder}
        required={required}
        type="text"
      />
    </div>
  );
}
