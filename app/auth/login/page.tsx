"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [inviteToken, setInviteToken] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite");

    if (token) {
      setInviteToken(token);
    }
  }, []);

  const routeAfterLogin = async () => {
    if (inviteToken) {
      window.location.assign(`/join/${inviteToken}`);
      return;
    }

    window.location.assign("/dashboard");
  };

  const handleLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setErrorMessage("Please enter email and password.");
      return;
    }

    setErrorMessage("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    try {
      await routeAfterLogin();
    } catch (error: any) {
      setErrorMessage(error?.message || "Login succeeded, but workspace routing failed.");
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #1d4ed8 0%, #07111f 45%, #020617 100%)",
        padding: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1200,
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: 28,
          alignItems: "stretch",
        }}
      >
        <section
          style={{
            color: "white",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.08)",
              marginBottom: 20,
              fontSize: 13,
              width: "fit-content",
            }}
          >
            Accountant Operating System
          </div>

          <h1
            style={{
              fontSize: "clamp(42px, 6vw, 76px)",
              lineHeight: 0.95,
              margin: 0,
              letterSpacing: -3,
              fontWeight: 900,
            }}
          >
            Secure HMRC workflows for modern UK practices.
          </h1>

          <p
            style={{
              marginTop: 24,
              color: "#cbd5e1",
              lineHeight: 1.8,
              fontSize: 18,
              maxWidth: 720,
            }}
          >
            Access your Hala Digital workspace for MTD ITSA obligations, cumulative quarterly workflows,
            immutable evidence records, Stripe billing controls, operational dashboards and accountant-grade
            review systems.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0,1fr))",
              gap: 16,
              marginTop: 30,
            }}
          >
            {[
              "HMRC OAuth integration",
              "Quarter workflow engine",
              "Immutable evidence vault",
              "RBAC practice controls",
              "Operational dashboards",
              "Billing lifecycle management",
            ].map((item) => (
              <div
                key={item}
                style={{
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 18,
                  padding: 16,
                  color: "#e2e8f0",
                  fontSize: 14,
                }}
              >
                ✓ {item}
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 32,
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              color: "#94a3b8",
              fontSize: 13,
            }}
          >
            <span>GDPR-aware architecture</span>
            <span>•</span>
            <span>Encrypted infrastructure</span>
            <span>•</span>
            <span>Accountant-focused SaaS</span>
          </div>
        </section>

        <section
          style={{
            background: "white",
            borderRadius: 32,
            padding: 36,
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.28)",
          }}
        >
          <div style={{ marginBottom: 26 }}>
            <p
              style={{
                color: "#2563eb",
                fontWeight: 800,
                marginBottom: 10,
                fontSize: 13,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Hala Digital
            </p>

            <h2 style={{ margin: 0, fontSize: 34, color: "#0f172a" }}>
              {inviteToken ? "Accept Invitation" : "Login to Workspace"}
            </h2>

            <p style={{ color: "#64748b", lineHeight: 1.7, marginTop: 12 }}>
              {inviteToken
                ? "Login to continue joining your firm workspace."
                : "Access your accountant SaaS platform and operational dashboard."}
            </p>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Email address</label>
            <input
              placeholder="you@firm.co.uk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) {
                  handleLogin();
                }
              }}
              style={inputStyle}
            />
          </div>

          {errorMessage && (
            <div
              style={{
                marginBottom: 16,
                padding: 14,
                borderRadius: 14,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                fontWeight: 700,
                lineHeight: 1.6,
              }}
            >
              {errorMessage}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: 14,
              border: "none",
              background: loading ? "#94a3b8" : "#0f172a",
              color: "white",
              fontWeight: 800,
              fontSize: 15,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Authenticating..." : "Access Workspace"}
          </button>

          <div
            style={{
              marginTop: 24,
              padding: 16,
              borderRadius: 16,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            <strong style={{ display: "block", marginBottom: 8, color: "#0f172a" }}>
              Enterprise SaaS Platform
            </strong>

            <p style={{ margin: 0, color: "#64748b", fontSize: 14, lineHeight: 1.7 }}>
              Hala Digital supports accounting practice workflows, evidence management and operational
              control systems. Firms remain responsible for professional review, client authority and
              statutory compliance decisions.
            </p>
          </div>

          <p style={{ marginTop: 22, fontSize: 14, color: "#64748b" }}>
            Don&apos;t have an account?{" "}
            <a
              href={inviteToken ? `/auth/register?invite=${inviteToken}` : "/auth/register"}
              style={{ color: "#2563eb", fontWeight: 800 }}
            >
              {inviteToken ? "Create account to join firm" : "Start free trial"}
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  fontWeight: 700,
  color: "#0f172a",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  fontSize: 15,
  outline: "none",
  background: "white",
};

