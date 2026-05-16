import Link from "next/link";

const plans = [
  {
    name: "Starter",
    price: "£29",
    note: "For small firms starting MTD ITSA workflows.",
    points: ["Core dashboard", "Client workspace", "HMRC workflow visibility", "Billing access control"],
    cta: "Start onboarding",
    href: "/auth/register",
  },
  {
    name: "Practice",
    price: "£99",
    note: "For active practices managing multiple MTD clients.",
    points: ["Operational dashboard", "Quarterly workflows", "Evidence snapshots", "Review and approval controls"],
    cta: "Start onboarding",
    href: "/auth/register",
    featured: true,
  },
  {
    name: "Scale",
    price: "£299",
    note: "For growing firms needing stronger operational control.",
    points: ["Larger client capacity", "Submission monitoring", "Workflow controls", "Priority product roadmap"],
    cta: "Start onboarding",
    href: "/auth/register",
  },
  {
    name: "Enterprise",
    price: "Custom",
    note: "For larger practices needing custom controls and support.",
    points: ["Unlimited clients", "Unlimited staff users", "Custom storage", "Implementation support"],
    cta: "Contact sales",
    href: "/contact",
  },
];

const features = [
  {
    title: "HMRC connection workflows",
    text: "Manage client authorisation, HMRC sync status and source-level MTD ITSA readiness from one workspace.",
  },
  {
    title: "Quarterly operating controls",
    text: "Track tax years, quarters, obligations, review states and submission readiness with accountant-friendly controls.",
  },
  {
    title: "Evidence-first architecture",
    text: "Preserve submission snapshots, audit trails, workflow states and amendment-safe records for internal review.",
  },
  {
    title: "Practice visibility",
    text: "Monitor overdue obligations, failed submissions, approval queues, sync warnings and evidence alerts.",
  },
  {
    title: "Billing access control",
    text: "Stripe subscription status controls platform access so firms can onboard, subscribe and continue securely.",
  },
  {
    title: "Built for UK firms",
    text: "Designed around accountant review, client responsibility, partner approval and compliance-safe workflows.",
  },
];

const steps = [
  "Create firm account",
  "Choose subscription",
  "Complete Stripe checkout",
  "Access practice dashboard",
];

export default function HomePage() {
  return (
    <main style={styles.page}>
      <header style={styles.nav}>
        <Link href="/" style={styles.brand}>
          <span style={styles.logo}>H</span>
          <span>
            <strong style={styles.brandName}>Hala Digital</strong>
            <span style={styles.brandText}>Accountant OS</span>
          </span>
        </Link>

        <nav style={styles.navLinks}>
          <Link href="#features" style={styles.navLink}>Platform</Link>
          <Link href="#pricing" style={styles.navLink}>Pricing</Link>
          <Link href="/auth/login" style={styles.navLink}>Login</Link>
          <Link href="/auth/register" style={styles.navButton}>Start onboarding</Link>
        </nav>
      </header>

      <section style={styles.hero}>
        <div style={styles.heroCopy}>
          <p style={styles.kicker}>MTD ITSA practice platform</p>

          <h1 style={styles.title}>
            Accountant-grade MTD ITSA workflows, evidence and control.
          </h1>

          <p style={styles.subtitle}>
            Hala Digital helps UK accountancy practices manage HMRC authorisation,
            client onboarding, quarterly workflows, review controls, evidence records,
            billing access and operational visibility from one secure SaaS workspace.
          </p>

          <div style={styles.actions}>
            <Link href="/auth/register" style={styles.primaryButton}>
              Start firm onboarding
            </Link>

            <Link href="/auth/login" style={styles.secondaryButton}>
              Login to workspace
            </Link>
          </div>

          <div style={styles.trustStrip}>
            <span>HMRC workflow support</span>
            <span>Immutable evidence approach</span>
            <span>Role-based controls</span>
            <span>GDPR-aware SaaS design</span>
          </div>
        </div>

        <div style={styles.previewCard}>
          <div style={styles.previewHeader}>
            <div>
              <p style={styles.previewKicker}>Practice control centre</p>
              <h2 style={styles.previewTitle}>Operational dashboard</h2>
            </div>
            <span style={styles.liveBadge}>Billing active</span>
          </div>

          <div style={styles.previewGrid}>
            <Metric label="Clients" value="3" />
            <Metric label="Open obligations" value="36" />
            <Metric label="Evidence snapshots" value="14" />
          </div>

          <div style={styles.previewPanel}>
            <div>
              <strong>Submission issues</strong>
              <p>HMRC logs requiring operational review.</p>
            </div>
            <span style={styles.warnBadge}>Action</span>
          </div>

          <div style={styles.previewPanel}>
            <div>
              <strong>Partner approvals</strong>
              <p>Review, lock and approve before submission.</p>
            </div>
            <span style={styles.safeBadge}>Controlled</span>
          </div>
        </div>
      </section>

      <section style={styles.flow}>
        {steps.map((step, index) => (
          <div key={step} style={styles.flowItem}>
            <span style={styles.stepNumber}>{index + 1}</span>
            <strong>{step}</strong>
          </div>
        ))}
      </section>

      <section id="features" style={styles.section}>
        <div style={styles.sectionHeader}>
          <p style={styles.kicker}>What the platform does</p>
          <h2 style={styles.sectionTitle}>A practice operating system for MTD ITSA delivery.</h2>
          <p style={styles.sectionText}>
            Built for firms that need safer quarterly workflows, clearer review control
            and better operational visibility across MTD clients.
          </p>
        </div>

        <div style={styles.cardGrid}>
          {features.map((feature) => (
            <article key={feature.title} style={styles.card}>
              <h3 style={styles.cardTitle}>{feature.title}</h3>
              <p style={styles.cardText}>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section style={styles.darkBand}>
        <div>
          <p style={styles.darkKicker}>Designed for accountant responsibility</p>
          <h2 style={styles.darkTitle}>Software supports the workflow. Your firm stays in control.</h2>
        </div>

        <div style={styles.darkList}>
          <p>Review, lock and approval workflows before submission.</p>
          <p>Evidence snapshots and audit history for internal records.</p>
          <p>Billing status controls access after subscription activation.</p>
          <p>Firms remain responsible for client authority, professional review and final submission decisions.</p>
        </div>
      </section>

      <section id="pricing" style={styles.section}>
        <div style={styles.sectionHeader}>
          <p style={styles.kicker}>Subscription plans</p>
          <h2 style={styles.sectionTitle}>Start small, then scale your practice workspace.</h2>
          <p style={styles.sectionText}>
            Select onboarding to create your firm account. After registration, subscription access is handled through Stripe checkout and billing controls.
          </p>
        </div>

        <div style={styles.pricingGrid}>
          {plans.map((plan) => (
            <article
              key={plan.name}
              style={{
                ...styles.planCard,
                ...(plan.featured ? styles.featuredPlan : {}),
              }}
            >
              {plan.featured && <span style={styles.planBadge}>Recommended</span>}
              <h3 style={styles.planName}>{plan.name}</h3>
              <div style={styles.priceRow}>
                <strong>{plan.price}</strong>
                {plan.price !== "Custom" && <span>/ month</span>}
              </div>
              <p style={styles.planNote}>{plan.note}</p>

              <div style={styles.planPoints}>
                {plan.points.map((point) => (
                  <span key={point}>? {point}</span>
                ))}
              </div>

              <Link
                href={plan.href}
                style={plan.featured ? styles.primaryButtonFull : styles.secondaryButtonFull}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section style={styles.cta}>
        <div>
          <p style={styles.kicker}>Ready to continue?</p>
          <h2 style={styles.ctaTitle}>Create your firm workspace or login to an existing account.</h2>
          <p style={styles.ctaText}>
            New firms should start onboarding. Existing subscribed firms can login directly.
          </p>
        </div>

        <div style={styles.ctaActions}>
          <Link href="/auth/register" style={styles.primaryButton}>Start onboarding</Link>
          <Link href="/auth/login" style={styles.secondaryButton}>Login</Link>
        </div>
      </section>

      <footer style={styles.footer}>
        <div>
          <strong>Hala Digital Ltd</strong>
          <p>Websites, SEO, automation and accountant SaaS tools for UK businesses.</p>
        </div>

        <div style={styles.footerLinks}>
          <Link href="/privacy" style={styles.footerLink}>Privacy</Link>
          <Link href="/terms" style={styles.footerLink}>Terms</Link>
          <Link href="/contact" style={styles.footerLink}>Contact</Link>
        </div>
      </footer>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%)",
    color: "#0f172a",
    fontFamily: "Inter, Arial, sans-serif",
  },
  nav: {
    minHeight: 74,
    background: "rgba(255,255,255,0.94)",
    borderBottom: "1px solid #e7edf5",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    padding: "0 7vw",
    position: "sticky",
    top: 0,
    zIndex: 10,
    backdropFilter: "blur(10px)",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    color: "#0f172a",
    textDecoration: "none",
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 14,
    background: "linear-gradient(135deg, #bae6fd, #22c55e)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    color: "#075985",
  },
  brandName: {
    display: "block",
    fontSize: 15,
    lineHeight: 1.1,
  },
  brandText: {
    display: "block",
    color: "#64748b",
    fontSize: 12,
    marginTop: 3,
  },
  navLinks: {
    display: "flex",
    alignItems: "center",
    gap: 18,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  navLink: {
    color: "#172033",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 750,
  },
  navButton: {
    background: "#172033",
    color: "white",
    textDecoration: "none",
    padding: "10px 14px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 850,
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.08fr) minmax(360px, 0.92fr)",
    gap: 34,
    alignItems: "center",
    padding: "70px 7vw 44px",
  },
  heroCopy: {
    maxWidth: 780,
  },
  kicker: {
    margin: 0,
    color: "#175cd3",
    fontSize: 12,
    fontWeight: 850,
    textTransform: "uppercase",
    letterSpacing: 1.3,
  },
  title: {
    margin: "12px 0 0",
    fontSize: "clamp(38px, 5vw, 66px)",
    lineHeight: 0.99,
    letterSpacing: "-0.055em",
    fontWeight: 900,
    color: "#07111f",
  },
  subtitle: {
    margin: "22px 0 0",
    color: "#475569",
    fontSize: 17,
    lineHeight: 1.65,
    maxWidth: 740,
  },
  actions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 28,
  },
  primaryButton: {
    background: "#172033",
    color: "white",
    textDecoration: "none",
    padding: "13px 18px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 850,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.16)",
  },
  secondaryButton: {
    background: "white",
    color: "#172033",
    border: "1px solid #d7dde7",
    textDecoration: "none",
    padding: "13px 18px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 850,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  trustStrip: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 22,
    color: "#475569",
    fontSize: 12,
    fontWeight: 750,
  },
  previewCard: {
    background: "white",
    border: "1px solid #e7edf5",
    borderRadius: 28,
    padding: 22,
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.12)",
  },
  previewHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  previewKicker: {
    margin: 0,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 850,
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  previewTitle: {
    margin: "4px 0 0",
    fontSize: 22,
    letterSpacing: "-0.035em",
  },
  liveBadge: {
    background: "#ecfdf3",
    color: "#067647",
    border: "1px solid #abefc6",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 850,
    whiteSpace: "nowrap",
  },
  previewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
    marginBottom: 14,
  },
  metric: {
    border: "1px solid #e7edf5",
    background: "#f8fafc",
    borderRadius: 16,
    padding: 12,
    display: "grid",
    gap: 6,
    color: "#475569",
    fontSize: 12,
    fontWeight: 750,
  },
  previewPanel: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "center",
    border: "1px solid #e7edf5",
    borderRadius: 18,
    padding: 14,
    marginTop: 10,
    background: "#fcfdff",
  },
  warnBadge: {
    background: "#fff4ed",
    color: "#b54708",
    borderRadius: 999,
    padding: "6px 9px",
    fontSize: 11,
    fontWeight: 850,
    whiteSpace: "nowrap",
  },
  safeBadge: {
    background: "#ecfdf3",
    color: "#067647",
    borderRadius: 999,
    padding: "6px 9px",
    fontSize: 11,
    fontWeight: 850,
    whiteSpace: "nowrap",
  },
  flow: {
    margin: "0 7vw",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  flowItem: {
    background: "white",
    border: "1px solid #e7edf5",
    borderRadius: 18,
    padding: 16,
    display: "flex",
    gap: 10,
    alignItems: "center",
    fontSize: 14,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 999,
    background: "#172033",
    color: "white",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 12,
  },
  section: {
    padding: "46px 7vw 22px",
  },
  sectionHeader: {
    maxWidth: 820,
    marginBottom: 20,
  },
  sectionTitle: {
    margin: "8px 0 0",
    fontSize: 32,
    letterSpacing: "-0.04em",
    lineHeight: 1.08,
  },
  sectionText: {
    margin: "10px 0 0",
    color: "#64748b",
    fontSize: 15,
    lineHeight: 1.6,
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(245px, 1fr))",
    gap: 14,
  },
  card: {
    background: "white",
    border: "1px solid #e7edf5",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.035)",
  },
  cardTitle: {
    margin: 0,
    fontSize: 17,
    letterSpacing: "-0.02em",
  },
  cardText: {
    margin: "9px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.55,
  },
  darkBand: {
    margin: "34px 7vw 0",
    background: "#0f172a",
    color: "white",
    borderRadius: 28,
    padding: 30,
    display: "grid",
    gridTemplateColumns: "0.85fr 1.15fr",
    gap: 26,
  },
  darkKicker: {
    margin: 0,
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: 850,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  darkTitle: {
    margin: "8px 0 0",
    fontSize: 30,
    letterSpacing: "-0.04em",
    lineHeight: 1.1,
  },
  darkList: {
    display: "grid",
    gap: 10,
    color: "#dbeafe",
    fontSize: 14,
    lineHeight: 1.5,
  },
  pricingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(235px, 1fr))",
    gap: 14,
  },
  planCard: {
    background: "white",
    border: "1px solid #e7edf5",
    borderRadius: 22,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    position: "relative",
  },
  featuredPlan: {
    border: "1px solid #172033",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.12)",
  },
  planBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    background: "#172033",
    color: "white",
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 11,
    fontWeight: 850,
  },
  planName: {
    margin: 0,
    fontSize: 19,
  },
  priceRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    color: "#64748b",
  },
  planNote: {
    margin: 0,
    color: "#64748b",
    fontSize: 13.5,
    lineHeight: 1.5,
  },
  planPoints: {
    display: "grid",
    gap: 8,
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.35,
    marginBottom: 4,
  },
  primaryButtonFull: {
    marginTop: "auto",
    background: "#172033",
    color: "white",
    textDecoration: "none",
    padding: "12px 14px",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 850,
    textAlign: "center",
  },
  secondaryButtonFull: {
    marginTop: "auto",
    background: "white",
    color: "#172033",
    border: "1px solid #d7dde7",
    textDecoration: "none",
    padding: "12px 14px",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 850,
    textAlign: "center",
  },
  cta: {
    margin: "34px 7vw",
    background: "white",
    border: "1px solid #e7edf5",
    borderRadius: 28,
    padding: 28,
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    alignItems: "center",
  },
  ctaTitle: {
    margin: "8px 0 0",
    fontSize: 28,
    letterSpacing: "-0.035em",
  },
  ctaText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 15,
  },
  ctaActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  footer: {
    background: "#0f172a",
    color: "white",
    padding: "26px 7vw",
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  footerLinks: {
    display: "flex",
    gap: 12,
  },
  footerLink: {
    color: "#c7d2fe",
    textDecoration: "none",
  },
};
