import { redirect } from "next/navigation";

export default function DashboardClientsRedirectPage() {
  redirect("/app/clients");
}