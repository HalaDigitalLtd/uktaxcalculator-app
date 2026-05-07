"use client";

import Link from "next/link";

export default function DashboardHomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f6f8fb",
        padding: "40px",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            fontSize: "42px",
            fontWeight: 900,
            marginBottom: "10px",
            color: "#111827",
          }}
        >
          Hala Digital MTD Dashboard
        </h1>

        <p
          style={{
            color: "#64748b",
            fontSize: "18px",
            marginBottom: "40px",
          }}
        >
          Main control centre for MTD ITSA workflow.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "20px",
          }}
        >
          <Link href="/dashboard/clients" style={cardStyle}>
            <h2 style={titleStyle}>Clients</h2>
            <p style={textStyle}>
              Open clients, tax years, quarters and submissions.
            </p>
          </Link>

          <Link href="/dashboard/hmrc-connect" style={cardStyle}>
            <h2 style={titleStyle}>HMRC Connect</h2>
            <p style={textStyle}>
              Manage HMRC OAuth connections and tokens.
            </p>
          </Link>

          <Link href="/dashboard/settings" style={cardStyle}>
            <h2 style={titleStyle}>Settings</h2>
            <p style={textStyle}>
              Firm settings and internal configuration.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: "20px",
  padding: "28px",
  textDecoration: "none",
  color: "#111827",
  boxShadow: "0 10px 25px rgba(15,23,42,0.06)",
};

const titleStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 900,
  marginBottom: "10px",
};

const textStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "15px",
};