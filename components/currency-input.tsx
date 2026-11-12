"use client";

import { useState } from "react";
import { formatMoneyText, normalizeMoneyText } from "@/lib/currency-text";

type CurrencyInputProps = {
  defaultValue?: number | string | null;
  name: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value?: string;
};

const inputClass =
  "min-w-0 flex-1 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400";

export function CurrencyInput({
  defaultValue,
  name,
  onValueChange,
  placeholder = "0.00",
  required = false,
  value,
}: CurrencyInputProps) {
  const [focused, setFocused] = useState(false);
  const inputValue = value === undefined ? undefined : focused ? normalizeMoneyText(value) : formatMoneyText(value);

  return (
    <div className="flex h-10 overflow-hidden rounded-lg border border-slate-200 bg-white transition focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100">
      <span className="flex items-center border-r border-sky-100 bg-sky-50 px-3 text-sm font-semibold text-sky-700">
        RM
      </span>
      <input
        className={inputClass}
        defaultValue={value === undefined ? formatMoneyText(defaultValue) : undefined}
        id={name}
        inputMode="decimal"
        name={name}
        onBlur={(event) => {
          setFocused(false);
          event.currentTarget.value = formatMoneyText(event.currentTarget.value);
          onValueChange?.(event.currentTarget.value);
        }}
        onChange={(event) => {
          event.currentTarget.value = normalizeMoneyText(event.currentTarget.value);
          onValueChange?.(event.currentTarget.value);
        }}
        onFocus={(event) => {
          setFocused(true);
          event.currentTarget.value = normalizeMoneyText(event.currentTarget.value);
          onValueChange?.(event.currentTarget.value);
        }}
        pattern="[0-9,]+([.][0-9]{0,2})?"
        placeholder={placeholder}
        required={required}
        type="text"
        value={inputValue}
      />
    </div>
  );
}
