"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type UpdateClientState = {
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
    const parts = [record.message, record.details, record.hint, record.code]
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    if (parts.length) return parts.join(" ");
  }
  return fallback;
}

export async function updateClient(
  _previousState: UpdateClientState,
  formData: FormData,
): Promise<UpdateClientState> {
  const clientId = textValue(formData, "client_id");
  const clientName = textValue(formData, "client_name");
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData?.claims) {
    return { error: "You must be logged in." };
  }

  if (!clientName) {
    return { error: "Client name is required." };
  }

  try {
    const { error } = await supabase
      .from("clients")
      .update({
        client_name: clientName,
        business_registration_no: optionalText(formData, "business_registration_no"),
        client_type: textValue(formData, "client_type") || "individual",
        referral: optionalText(formData, "referral"),
        phone: optionalText(formData, "phone"),
        email: optionalText(formData, "email"),
        address: optionalText(formData, "address"),
        notes: optionalText(formData, "notes"),
      })
      .eq("id", clientId);
    if (error) throw error;

    await supabase.from("activity_logs").insert({
      record_type: "client",
      record_id: clientId,
      action: "update",
      message: `Updated client ${clientName}.`,
      created_by: userData.claims.sub,
    });

    revalidatePath("/protected");
    revalidatePath("/protected/clients");
    revalidatePath(`/protected/clients/${clientId}`);
    return { success: "Client saved." };
  } catch (error) {
    return {
      error: readableError(error, "Client could not be saved."),
    };
  }
}
