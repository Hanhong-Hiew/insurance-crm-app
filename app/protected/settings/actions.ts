"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

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

export async function saveInsuranceType(formData: FormData) {
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
  revalidatePath("/protected/settings");
}

export async function saveInsurer(formData: FormData) {
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
  revalidatePath("/protected/settings");
}

export async function saveCommissionRate(formData: FormData) {
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
  revalidatePath("/protected/settings");
}

export async function saveSplitPattern(formData: FormData) {
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
  revalidatePath("/protected/settings");
}

export async function savePayee(formData: FormData) {
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
  revalidatePath("/protected/settings");
}
