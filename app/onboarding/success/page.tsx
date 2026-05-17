export default function OnboardingSuccessPage() {
  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.badge}>Payment Successful</div>

        <h1 style={styles.title}>Your Hala Digital workspace is active</h1>

        <p style={styles.subtitle}>
          Your subscription has been confirmed and your firm workspace has been securely provisioned. You can now log in and access your dashboard.
        </p>

        <div style={styles.grid}>
          <div style={styles.infoBox}>
            <strong>Workspace</strong>
            <span>Activated after successful Stripe payment</span>
          </div>

          <div style={styles.infoBox}>
            <strong>Access</strong>
            <span>Use the email and password created during registration</span>
          </div>

          <div style={styles.infoBox}>
            <strong>Security</strong>
            <span>Firm access is protected by tenant isolation and role-based controls</span>
          </div>

          <div style={styles.infoBox}>
            <strong>Billing</strong>
            <span>Your subscription is now linked to your practice workspace</span>
          </div>
        </div>

        <a href="/auth/login" style={styles.primaryButton}>
          Login to Dashboard
        </a>

        <p style={styles.footerText}>
          After login, you will be taken to your firm dashboard where you can manage clients, team members, billing and HMRC workflows.
        </p>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(37,99,235,0.12), transparent 30%), linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%)",
    padding: 40,
    fontFamily: "Inter, Arial, sans-serif",
    color: "#0f172a",
  },
  card: {
    maxWidth: 760,
    margin: "70px auto",
    background: "white",
    padding: 38,
    borderRadius: 24,
    border: "1px solid #e5eaf1",
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.10)",
  },
  badge: {
    display: "inline-block",
    background: "#ecfdf3",
    color: "#166534",
    border: "1px solid #86efac",
    borderRadius: 999,
    padding: "7px 12px",
    fontSize: 12,
    fontWeight: 850,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    margin: "18px 0 12px",
    fontSize: 44,
    lineHeight: 1.02,
    letterSpacing: "-0.05em",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 16,
    lineHeight: 1.7,
    maxWidth: 660,
    marginBottom: 24,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: 14,
    margin: "24px 0",
  },
  infoBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 7,
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.5,
  },
  primaryButton: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    textAlign: "center",
    background: "#0f172a",
    color: "white",
    padding: "15px 18px",
    borderRadius: 14,
    fontWeight: 900,
    textDecoration: "none",
    marginTop: 8,
  },
  footerText: {
    margin: "18px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.6,
    textAlign: "center",
  },
};
