"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

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
        .maybeSingle();

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

    try {
      if (inviteData) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (error) throw error;

        const userId = data.user?.id;

        if (!userId) {
          throw new Error("User not created properly.");
        }

        const invitedRole = inviteData.role || "staff";

        const { error: linkError } = await supabase
          .from("firm_users")
          .upsert(
            {
              firm_id: inviteData.firm_id,
              user_id: userId,
              email: cleanEmail,
              role: invitedRole,
              is_active: true,
              status: "active",
              invited_by: inviteData.invited_by || null,
              approved_by: inviteData.invited_by || null,
              updated_at: new Date().toISOString(),
              meta: {
                source: "invite_acceptance",
                invitation_id: inviteData.id,
                membership_status: "accepted",
                accepted_at: new Date().toISOString(),
              },
            },
            { onConflict: "firm_id,user_id" }
          );

        if (linkError) throw linkError;

        await supabase
          .from("firm_invitations")
          .update({
            accepted_at: new Date().toISOString(),
            accepted_by: userId,
          })
          .eq("id", inviteData.id);

        window.location.href = "/dashboard/clients";
        return;
      }

      const response = await fetch("/api/auth/register-workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          firmName: cleanFirmName,
        }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Registration failed.");
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (loginError) {
        window.location.href = "/auth/login";
        return;
      }

      if (payload.firmId) {
        localStorage.setItem("active_firm_id", payload.firmId);
      }

      window.location.href = "/dashboard/clients";
    } catch (error: any) {
      alert(error?.message || "Registration failed.");
      setLoading(false);
    }
  };

  if (checkingInvite) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>Loading...</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <p style={styles.kicker}>Hala Digital SaaS</p>

        <h1 style={styles.title}>
          {inviteData ? "Join Firm" : "Start Your Practice Workspace"}
        </h1>

        <p style={styles.subtitle}>
          {inviteData
            ? "Create your user account to join the firm workspace."
            : "Create your Hala Digital accountant SaaS workspace."}
        </p>

        {!inviteData && (
          <div style={styles.includeBox}>
            <strong>Includes:</strong>
            <ul style={{ marginBottom: 0 }}>
              <li>14-day SaaS trial</li>
              <li>MTD ITSA workspace</li>
              <li>HMRC workflow foundation</li>
              <li>Evidence and billing architecture</li>
            </ul>
          </div>
        )}

        {inviteData && (
          <div style={styles.inviteBox}>
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
            style={styles.input}
          />
        )}

        <input
          placeholder="Email"
          value={email}
          disabled={!!inviteData}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            ...styles.input,
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
          style={styles.input}
        />

        <button
          onClick={handleRegister}
          disabled={loading}
          style={{
            ...styles.button,
            background: loading ? "#94a3b8" : "#0f172a",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading
            ? "Creating workspace..."
            : inviteData
              ? "Join Firm"
              : "Start Free Trial"}
        </button>

        <p style={styles.loginText}>
          Already have an account?{" "}
          <a
            href={
              inviteToken
                ? `/auth/login?invite=${inviteToken}`
                : "/auth/login"
            }
            style={styles.loginLink}
          >
            Login
          </a>
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%)",
    padding: 40,
    fontFamily: "Inter, Arial, sans-serif",
    color: "#0f172a",
  },
  card: {
    maxWidth: 520,
    margin: "80px auto",
    background: "white",
    padding: 30,
    borderRadius: 18,
    border: "1px solid #e5eaf1",
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
  },
  kicker: {
    margin: 0,
    color: "#175cd3",
    fontSize: 12,
    fontWeight: 850,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  title: {
    margin: "8px 0 8px",
    fontSize: 34,
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 14,
    marginBottom: 20,
  },
  includeBox: {
    background: "#ecfeff",
    border: "1px solid #a5f3fc",
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  inviteBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  input: {
    width: "100%",
    padding: 11,
    marginBottom: 12,
    borderRadius: 9,
    border: "1px solid #d1d5db",
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: "12px 14px",
    color: "white",
    border: "none",
    borderRadius: 10,
    fontWeight: 850,
  },
  loginText: {
    marginTop: 16,
    fontSize: 14,
  },
  loginLink: {
    color: "#2563eb",
    fontWeight: 700,
  },
};
