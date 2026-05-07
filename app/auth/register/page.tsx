"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

const ADMIN_EMAILS = ["ikramzaman@gmail.com", "ikramzaman+test4@gmail.com"];

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firmName, setFirmName] = useState("");
  const [loading, setLoading] = useState(false);

  const [inviteToken, setInviteToken] = useState("");
  const [inviteData, setInviteData] = useState<any>(null);
  const [checkingInvite, setCheckingInvite] = useState(true);

  useEffect(() => {
    const checkInvite = async () => {
      if (typeof window === "undefined") return;

      const params = new URLSearchParams(window.location.search);
      const token = params.get("invite");

      if (!token) {
        setCheckingInvite(false);
        return;
      }

      setInviteToken(token);

      const { data } = await supabase
        .from("firm_invitations")
        .select("*")
        .eq("token", token)
        .single();

      if (data) {
        setInviteData(data);
        setEmail(data.email || "");
      }

      setCheckingInvite(false);
    };

    checkInvite();
  }, []);

  const handleRegister = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanFirmName = firmName.trim();

    if (!cleanEmail || !password) {
      alert("Please enter email and password.");
      return;
    }

    if (!inviteData && !cleanFirmName) {
      alert("Please enter firm name.");
      return;
    }

    if (password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const userId = data.user?.id;

    if (!userId) {
      alert("User not created properly.");
      setLoading(false);
      return;
    }

    if (inviteData) {
      const { error: linkError } = await supabase.from("firm_users").insert([
        {
          firm_id: inviteData.firm_id,
          user_id: userId,
          role: inviteData.role || "staff",
        },
      ]);

      if (linkError && !linkError.message.toLowerCase().includes("duplicate")) {
        alert(linkError.message);
        setLoading(false);
        return;
      }

      await supabase
        .from("firm_invitations")
        .update({
          accepted_at: new Date().toISOString(),
          accepted_by: userId,
        })
        .eq("id", inviteData.id);

      alert("Account created and linked to firm successfully.");
      window.location.href = "/app/clients";
      return;
    }

    const slug =
      cleanFirmName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-") +
      "-" +
      Date.now();

    const { data: firmData, error: firmError } = await supabase
      .from("firms")
      .insert([
        {
          name: cleanFirmName,
          slug,
        },
      ])
      .select()
      .single();

    if (firmError) {
      alert(firmError.message);
      setLoading(false);
      return;
    }

    const { error: linkError } = await supabase.from("firm_users").insert([
      {
        firm_id: firmData.id,
        user_id: userId,
        role: "owner",
      },
    ]);

    if (linkError) {
      alert(linkError.message);
      setLoading(false);
      return;
    }

    alert("Account and firm created successfully.");

    setTimeout(() => {
      if (ADMIN_EMAILS.includes(cleanEmail)) {
        window.location.href = "/admin/firms";
      } else {
        window.location.href = "/app/clients";
      }
    }, 300);
  };

  if (checkingInvite) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f6f8fb",
          padding: 40,
        }}
      >
        Loading...
      </main>
    );
  }

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
          maxWidth: 460,
          margin: "80px auto",
          background: "white",
          padding: 30,
          borderRadius: 12,
          border: "1px solid #e5e7eb",
        }}
      >
        <h1 style={{ marginBottom: 8 }}>
          {inviteData ? "Join Firm" : "Register Firm"}
        </h1>

        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>
          {inviteData
            ? "You were invited to join a firm workspace."
            : "Create a private beta account for your accountancy firm."}
        </p>

        {inviteData && (
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 14,
              marginBottom: 18,
            }}
          >
            <p style={{ marginTop: 0 }}>
              <strong>Invited Email:</strong> {inviteData.email}
            </p>

            <p style={{ marginBottom: 0 }}>
              <strong>Role:</strong> {inviteData.role}
            </p>
          </div>
        )}

        {!inviteData && (
          <input
            placeholder="Firm Name"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              marginBottom: 12,
              borderRadius: 6,
              border: "1px solid #ddd",
            }}
          />
        )}

        <input
          placeholder="Email"
          value={email}
          disabled={!!inviteData}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            marginBottom: 12,
            borderRadius: 6,
            border: "1px solid #ddd",
            background: inviteData ? "#f3f4f6" : "white",
          }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) handleRegister();
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
          onClick={handleRegister}
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
          {loading
            ? "Creating account..."
            : inviteData
            ? "Join Firm"
            : "Register Firm"}
        </button>

        <p style={{ marginTop: 15, fontSize: 14 }}>
          Already have an account?{" "}
          <a
            href={inviteToken ? `/auth/login?invite=${inviteToken}` : "/auth/login"}
            style={{ color: "#2563eb" }}
          >
            Login
          </a>
        </p>
      </div>
    </main>
  );
}