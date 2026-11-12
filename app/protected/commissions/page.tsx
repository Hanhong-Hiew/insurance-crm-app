import { redirect } from "next/navigation";

export default function LegacyCommissionsPage() {
  redirect("/protected/commission-payments");
}
