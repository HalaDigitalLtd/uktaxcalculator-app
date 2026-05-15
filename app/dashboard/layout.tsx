import StrictBillingGate from "../../components/billing/StrictBillingGate";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StrictBillingGate>{children}</StrictBillingGate>;
}
