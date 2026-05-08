"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteToken, setInviteToken] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite");
    if (token) setInviteToken(token);
  }, []);

  const routeAfterLogin = async () => {
    if (inviteToken) {
      window.location.href = `/join/${inviteToken}`;
      return;
    }

    const impersonatedFirmId = localStorage.getItem("impersonate_firm_id");

    const { data: isHalaAdmin } = await supabase.rpc("is_hala_admin");

    const { data: firmId } = await supabase.rpc("get_current_active_firm_id", {
      impersonated_firm_id: impersonatedFirmId || null,
    });

    if (isHalaAdmin && !firmId) {
      window.location.href = "/admin/firms";
      return;
    }

    if (firmId) {
      window.location.href = "/dashboard/clients";
      return;
    }

    window.location.href = "/dashboard";
  };

  const handleLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      alert("Please enter email and password.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    await routeAfterLogin();
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f6f8fb", padding: 40 }}>
      <div
        style={{
          maxWidth: 420,
          margin: "80px auto",
          background: "white",
          padding: 30,
          borderRadius: 16,
          border: "1px solid #e5e7eb",
        }}
      >
        <h1 style={{ marginBottom: 8 }}>Login</h1>

        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>
          {inviteToken
            ? "Login to accept your firm invitation."
            : "Access your Hala MTD firm workspace."}
        </p>

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) handleLogin();
          }}
          style={inputStyle}
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: "100%",
            padding: "11px 14px",
            background: loading ? "#94a3b8" : "#0f172a",
            color: "white",
            border: "none",
            borderRadius: 10,
            fontWeight: 800,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <p style={{ marginTop: 16, fontSize: 14 }}>
          Don’t have an account?{" "}
          <a
            href={
              inviteToken
                ? `/auth/register?invite=${inviteToken}`
                : "/auth/register"
            }
            style={{ color: "#2563eb", fontWeight: 700 }}
          >
            {inviteToken ? "Create account to join firm" : "Register your firm"}
          </a>
        </p>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 11,
  marginBottom: 12,
  borderRadius: 8,
  border: "1px solid #d1d5db",
};