"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { accuracyDate } from "@/lib/policy-accuracy-server";

export type CommissionPaymentState = {error?: string; success?: string; resultId?: string};

export async function confirmCommissionPayment(_previous:CommissionPaymentState,formData:FormData):Promise<CommissionPaymentState> {
  try {
    const supabase=await createClient();
    const {data:user,error:authError}=await supabase.auth.getClaims();
    if(authError || !user?.claims) throw new Error("You must be logged in.");
    const ids=formData.getAll("commission_id").map(String).filter(Boolean);
    const raw=String(formData.get("paid_date")??"");
    // The existing payment panel submits its formatted date as an ISO hidden value.
    const date=accuracyDate(/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw.split("-").reverse().join("/"):raw);
    const {data:count,error}=await supabase.rpc("kover_confirm_commission_payment",{
      p_ids:ids,p_paid_date:date,p_notes:String(formData.get("notes")??"").trim()||null,
    });
    if(error) throw error;
    for(const path of ["/protected","/protected/records","/protected/commission-payments","/protected/policies"]) revalidatePath(path);
    return {success:`Marked ${count} commission rows paid. Statements saved.`,resultId:crypto.randomUUID()};
  } catch(error) {
    return {error:error instanceof Error?error.message:typeof error==="object"&&error&&"message" in error?String(error.message):"Payment was not saved.",resultId:crypto.randomUUID()};
  }
}
