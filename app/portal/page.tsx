import Link from "next/link";

export default function PortalPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f6f8fb",
        padding: 40,
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "80px auto",
          background: "white",
          padding: 40,
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <p style={{ color: "#2563eb", fontWeight: 700, margin: 0 }}>
          Hala Digital
        </p>

        <h1 style={{ marginBottom: 10 }}>
          Hala MTD Portal (Private Beta)
        </h1>

        <p style={{ color: "#555", fontSize: 16, marginBottom: 20 }}>
          Built for UK accountancy firms to manage MTD ITSA clients,
          quarterly obligations, reminders and submissions — all in one place.
        </p>

        <ul style={{ color: "#444", fontSize: 15, paddingLeft: 18 }}>
          <li>Manage multiple clients under one firm</li>
          <li>Track quarterly MTD obligations</li>
          <li>Bulk upload transactions via CSV</li>
          <li>Auto categorisation for income & expenses</li>
          <li>Submission-ready workflow (HMRC integration coming)</li>
        </ul>

        <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
          <Link href="/auth/login" style={buttonDark}>
            Login to Portal
          </Link>

          <Link href="/auth/register" style={buttonLight}>
            Join Private Beta
          </Link>
        </div>

        <p style={{ color: "#777", fontSize: 13, marginTop: 20 }}>
          Access is currently limited. Early firms will receive lifetime
          discounted pricing.
        </p>
      </div>
    </main>
  );
}

const buttonDark = {
  background: "#0f172a",
  color: "white",
  padding: "12px 18px",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 700,
};

const buttonLight = {
  background: "#e5e7eb",
  color: "#0f172a",
  padding: "12px 18px",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 700,
};