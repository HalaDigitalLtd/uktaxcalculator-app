"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

const ADMIN_EMAILS = ["ikramzaman@gmail.com", "ikramzaman+test4@gmail.com"];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteToken, setInviteToken] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite");

    if (token) {
      setInviteToken(token);
    }
  }, []);

  const handleLogin = async () => {
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setTimeout(() => {
      if (inviteToken) {
        window.location.href = `/join/${inviteToken}`;
        return;
      }

      if (ADMIN_EMAILS.includes(cleanEmail)) {
        window.location.href = "/admin/firms";
      } else {
        window.location.href = "/app/clients";
      }
    }, 300);
  };

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
          maxWidth: 400,
          margin: "80px auto",
          background: "white",
          padding: 30,
          borderRadius: 12,
          border: "1px solid #e5e7eb",
        }}
      >
        <h1 style={{ marginBottom: 8 }}>Login</h1>

        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>
          {inviteToken
            ? "Login to accept your firm invitation."
            : "Access your Hala MTD Portal account."}
        </p>

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            marginBottom: 12,
            borderRadius: 6,
            border: "1px solid #ddd",
          }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) handleLogin();
          }}
          style={{
            width: "100%",
            padding: 10,
            marginBottom: 16,
            borderRadius: 6,
            border: "1px solid #ddd",
          }}
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px 14px",
            background: loading ? "#ccc" : "#0f172a",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <p style={{ marginTop: 15, fontSize: 14 }}>
          Don’t have an account?{" "}
          <a
            href={
              inviteToken
                ? `/auth/register?invite=${inviteToken}`
                : "/auth/register"
            }
            style={{ color: "#2563eb" }}
          >
            {inviteToken ? "Create account to join firm" : "Register your firm"}
          </a>
        </p>
      </div>
    </main>
  );
}