"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value || null;
}

export async function updateClient(formData: FormData) {
  const clientId = textValue(formData, "client_id");
  const clientName = textValue(formData, "client_name");
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData?.claims) {
    throw new Error("You must be logged in.");
  }

  if (!clientName) {
    throw new Error("Client name is required.");
  }

  const { error } = await supabase
    .from("clients")
    .update({
      client_code: optionalText(formData, "client_code"),
      client_name: clientName,
      client_type: textValue(formData, "client_type") || "individual",
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
  redirect(`/protected/clients/${clientId}`);
}
