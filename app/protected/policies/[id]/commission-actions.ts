"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { accuracyDate } from "@/lib/policy-accuracy-server";
import { signedCommissionAmount } from "@/lib/commission-adjustments";

export type CommissionRowState = {error?:string; success?:string; resultId?:string};

export async function changeCommissionRow(_previous:CommissionRowState,data:FormData):Promise<CommissionRowState> {
  try {
    const text=(key:string)=>String(data.get(key)??"").trim();
    const supabase=await createClient();
    const {data:user,error:authError}=await supabase.auth.getClaims();
    if(authError || !user?.claims) throw new Error("You must be logged in.");
    const operation=text("operation");
    let error;
    if(operation==="paid_date") {
      ({error}=await supabase.rpc("kover_commission_paid_date",{p_id:text("commission_id"),p_date:accuracyDate(text("paid_date"))}));
    } else if(operation==="delete") {
      ({error}=await supabase.rpc("kover_delete_adjustment",{p_term_id:text("policy_term_id"),p_id:text("commission_id")}));
    } else if(operation==="save") {
      ({error}=await supabase.rpc("kover_save_adjustment",{
        p_term_id:text("policy_term_id"),p_id:text("commission_id")||null,p_payee_id:text("payee_id"),
        p_amount:signedCommissionAmount(text("amount")),p_note:text("note"),p_status:text("status")||"unpaid",
        p_paid_date:text("status")==="paid"?accuracyDate(text("paid_date")):null,
      }));
    } else throw new Error("Unknown commission action.");
    if(error) throw error;
    for(const path of ["/protected","/protected/records","/protected/commission-payments",`/protected/policies/${text("policy_term_id")}`,`/protected/policies/${text("policy_term_id")}/edit`]) revalidatePath(path);
    return {success:operation==="delete"?"Adjustment deleted.":operation==="paid_date"?"Paid date updated. Amount and statement unchanged.":"Adjustment saved.",resultId:crypto.randomUUID()};
  } catch(error) {
    return {error:error instanceof Error?error.message:typeof error==="object"&&error&&"message" in error?String(error.message):"Commission change was not saved.",resultId:crypto.randomUUID()};
  }
}
