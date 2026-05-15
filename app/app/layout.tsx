import StrictBillingGate from "../../components/billing/StrictBillingGate";

export default function AppPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StrictBillingGate>{children}</StrictBillingGate>;
}
