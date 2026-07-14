"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ClientActionState = {
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

async function requireUser() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();
  if (userError || !userData?.claims) {
    return { error: "You must be logged in.", supabase: null, userId: null };
  }
  return { error: null, supabase, userId: userData.claims.sub as string };
}

export async function createClientRecord(
  _previousState: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const clientName = textValue(formData, "client_name");
  if (!clientName) return { error: "Client name is required." };

  const { error: authError, supabase, userId } = await requireUser();
  if (authError || !supabase || !userId) return { error: authError ?? "Login required." };

  try {
    const { data: createdClient, error } = await supabase
      .from("clients")
      .insert({
        client_name: clientName,
        business_registration_no: optionalText(formData, "business_registration_no"),
        client_type: textValue(formData, "client_type") || "individual",
        phone: optionalText(formData, "phone"),
        email: optionalText(formData, "email"),
      })
      .select("id")
      .single();
    if (error) throw error;

    await supabase.from("activity_logs").insert({
      record_type: "client",
      record_id: createdClient.id,
      action: "create",
      message: `Created client ${clientName}.`,
      created_by: userId,
    });

    revalidatePath("/protected");
    revalidatePath("/protected/clients");
    return { success: "Client added." };
  } catch (error) {
    return { error: readableError(error, "Client could not be added.") };
  }
}

export async function deleteClientRecord(
  _previousState: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const clientId = textValue(formData, "client_id");
  const clientName = textValue(formData, "client_name");
  if (!clientId) return { error: "Missing client record." };

  const { error: authError, supabase, userId } = await requireUser();
  if (authError || !supabase || !userId) return { error: authError ?? "Login required." };

  try {
    const { count, error: countError } = await supabase
      .from("policy_series")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId);
    if (countError) throw countError;
    if ((count ?? 0) > 0) {
      return { error: "Client has linked policies and cannot be deleted." };
    }

    const { error } = await supabase.from("clients").delete().eq("id", clientId);
    if (error) throw error;

    await supabase.from("activity_logs").insert({
      record_type: "client",
      record_id: clientId,
      action: "delete",
      message: `Deleted client ${clientName || clientId}.`,
      created_by: userId,
    });

    revalidatePath("/protected");
    revalidatePath("/protected/clients");
    return { success: "Client deleted." };
  } catch (error) {
    return { error: readableError(error, "Client could not be deleted.") };
  }
}
