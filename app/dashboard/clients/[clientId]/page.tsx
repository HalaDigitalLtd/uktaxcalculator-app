import { redirect } from "next/navigation";

export default function DashboardClientDetailRedirectPage({
  params,
}: {
  params: { clientId: string };
}) {
  redirect(`/app/clients/${params.clientId}`);
}