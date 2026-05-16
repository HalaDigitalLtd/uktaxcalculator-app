import StrictBillingGate from "../../components/billing/StrictBillingGate";
import DashboardShell from "../../components/shell/DashboardShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StrictBillingGate>
      <DashboardShell>{children}</DashboardShell>
    </StrictBillingGate>
  );
}
