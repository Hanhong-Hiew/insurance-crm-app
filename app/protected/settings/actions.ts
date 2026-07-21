"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type SettingsActionState = {
  error?: string;
  success?: string;
};

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value || null;
}

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function percentValue(formData: FormData, key: string) {
  const raw = textValue(formData, key).replace("%", "");
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${key.replaceAll("_", " ")} must be a valid percentage.`);
  }
  return value > 1 ? value / 100 : value;
}

async function requireSupabase() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) throw new Error("You must be logged in.");
  return supabase;
}

function readableError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    if (parts.length) return parts.join(" ");
  }
  return fallback;
}

async function finishSettingsSave(
  operation: () => Promise<void>,
  success: string,
  fallback: string,
): Promise<SettingsActionState> {
  try {
    await operation();
    revalidatePath("/protected/settings");
    revalidatePath("/protected/new-policy");
    return { success };
  } catch (error) {
    return { error: readableError(error, fallback) };
  }
}

export async function saveInsuranceType(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  return finishSettingsSave(async () => {
    const supabase = await requireSupabase();
    const id = optionalText(formData, "id");
    const values = {
      active: checkboxValue(formData, "active"),
      code: textValue(formData, "code").toLowerCase().replace(/\s+/g, "_"),
      name: textValue(formData, "name"),
      notes: optionalText(formData, "notes"),
    };
    if (!values.code || !values.name) throw new Error("Insurance type code and name are required.");

    const result = id
      ? await supabase.from("insurance_types").update(values).eq("id", id)
      : await supabase.from("insurance_types").insert(values);
    if (result.error) throw result.error;
  }, "Insurance type saved.", "Insurance type could not be saved.");
}

export async function saveInsurer(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  return finishSettingsSave(async () => {
    const supabase = await requireSupabase();
    const id = optionalText(formData, "id");
    const values = {
      active: checkboxValue(formData, "active"),
      insurer_name: textValue(formData, "insurer_name"),
      notes: optionalText(formData, "notes"),
      short_name: optionalText(formData, "short_name"),
    };
    if (!values.insurer_name) throw new Error("Insurer name is required.");

    const result = id
      ? await supabase.from("insurers").update(values).eq("id", id)
      : await supabase.from("insurers").insert(values);
    if (result.error) throw result.error;
  }, "Insurer saved.", "Insurer could not be saved.");
}

export async function saveCommissionRate(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  return finishSettingsSave(async () => {
    const supabase = await requireSupabase();
    const id = optionalText(formData, "id");
    const values = {
      active: checkboxValue(formData, "active"),
      gross_commission_percent: percentValue(formData, "gross_commission_percent"),
      insurance_type_id: textValue(formData, "insurance_type_id"),
      net_commission_percent: percentValue(formData, "net_commission_percent"),
      notes: optionalText(formData, "notes"),
    };
    if (!values.insurance_type_id) throw new Error("Insurance type is required.");

    const result = id
      ? await supabase.from("commission_rate_settings").update(values).eq("id", id)
      : await supabase.from("commission_rate_settings").insert(values);
    if (result.error) throw result.error;
  }, "Commission rate saved.", "Commission rate could not be saved.");
}

export async function saveSplitPattern(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  return finishSettingsSave(async () => {
    const supabase = await requireSupabase();
    const id = optionalText(formData, "id");
    const values = {
      active: checkboxValue(formData, "active"),
      code: textValue(formData, "code").toUpperCase(),
      name: textValue(formData, "name"),
      notes: optionalText(formData, "notes"),
    };
    if (!values.code || !values.name) throw new Error("Split code and name are required.");

    const result = id
      ? await supabase.from("commission_split_patterns").update(values).eq("id", id)
      : await supabase.from("commission_split_patterns").insert(values);
    if (result.error) throw result.error;
  }, "Split pattern saved.", "Split pattern could not be saved.");
}

export async function savePayee(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  return finishSettingsSave(async () => {
    const supabase = await requireSupabase();
    const id = optionalText(formData, "id");
    const values = {
      active: checkboxValue(formData, "active"),
      name: textValue(formData, "name"),
      notes: optionalText(formData, "notes"),
    };
    if (!values.name) throw new Error("Payee name is required.");

    const result = id
      ? await supabase.from("commission_payees").update(values).eq("id", id)
      : await supabase.from("commission_payees").insert(values);
    if (result.error) throw result.error;
  }, "Commission payee saved.", "Commission payee could not be saved.");
}
