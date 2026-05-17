"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type PlanSlug = "starter" | "practice" | "scale" | "enterprise";

const PLAN_OPTIONS: { slug: PlanSlug; title: string; price: string; description: string }[] = [
  { slug: "starter", title: "Starter", price: "£29/mo", description: "For sole practitioners and small firms." },
  { slug: "practice", title: "Practice", price: "£99/mo", description: "For growing accountant practices." },
  { slug: "scale", title: "Scale", price: "£299/mo", description: "For operational multi-user firms." },
  { slug: "enterprise", title: "Enterprise", price: "Custom", description: "For high-volume enterprise firms." },
];

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firmName, setFirmName] = useState("");
  const [authorisedContactName, setAuthorisedContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [professionalBody, setProfessionalBody] = useState("");
  const [practiceType, setPracticeType] = useState("");
  const [estimatedClientCount, setEstimatedClientCount] = useState("");
  const [country, setCountry] = useState("United Kingdom");

  const [loading, setLoading] = useState(false);
  const [verificationMode, setVerificationMode] = useState(false);
  const [verificationUrl, setVerificationUrl] = useState("");
  const [registrationId, setRegistrationId] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanSlug>("practice");

  const [inviteToken, setInviteToken] = useState("");
  const [inviteData, setInviteData] = useState<any>(null);
  const [checkingInvite, setCheckingInvite] = useState(true);

  const queryState = useMemo(() => {
    if (typeof window === "undefined") {
      return { verified: null, registration: null, checkout: null };
    }

    const params = new URLSearchParams(window.location.search);

    return {
      verified: params.get("verified"),
      registration: params.get("registration"),
      checkout: params.get("checkout"),
    };
  }, []);

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

  useEffect(() => {
    if (queryState.registration) {
      setRegistrationId(queryState.registration);
      setVerificationMode(true);
    }
  }, [queryState.registration]);

  const handleRegister = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanFirmName = firmName.trim();
    const cleanAuthorisedContactName = authorisedContactName.trim();

    if (!cleanEmail || !password) {
      alert("Please enter email and password.");
      return;
    }

    if (!inviteData && (!cleanFirmName || !cleanAuthorisedContactName)) {
      alert("Please complete the required onboarding details.");
      return;
    }

    if (password.length < 8) {
      alert("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      if (inviteData) {
        const response = await fetch("/api/auth/accept-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail, password, inviteToken }),
        });

        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.message || "Unable to join firm.");
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
        return;
      }

      const response = await fetch("/api/onboarding/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          firmName: cleanFirmName,
          authorisedContactName: cleanAuthorisedContactName,
          phone,
          professionalBody,
          practiceType,
          estimatedClientCount,
          country,
        }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Registration failed.");
      }

      setRegistrationId(payload.registrationId);
      setVerificationUrl(payload.verificationUrl || "");
      setVerificationMode(true);
    } catch (error: any) {
      alert(error?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!registrationId) {
      alert("Missing onboarding registration.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/onboarding/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId, planSlug: selectedPlan }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.success || !payload.url) {
        throw new Error(payload.message || "Unable to start checkout.");
      }

      window.location.href = payload.url;
    } catch (error: any) {
      alert(error?.message || "Unable to start checkout.");
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
          {inviteData
            ? "Join Firm"
            : verificationMode
              ? "Verify & Activate Your Practice"
              : "Start Your Accountant Workspace"}
        </h1>

        <p style={styles.subtitle}>
          {inviteData
            ? "Create your user account to join the firm workspace."
            : "Payment-first accountant SaaS onboarding with secure billing activation before workspace access."}
        </p>

        {queryState.verified === "success" && (
          <div style={styles.successBox}>
            Email verified successfully. Continue with your subscription setup.
          </div>
        )}

        {queryState.checkout === "cancelled" && (
          <div style={styles.warningBox}>
            Checkout was cancelled. You can restart billing activation below.
          </div>
        )}

        {!inviteData && !verificationMode && (
          <>
            <div style={styles.includeBox}>
              <strong>Platform Includes:</strong>
              <ul style={{ marginBottom: 0 }}>
                <li>MTD ITSA operational workflows</li>
                <li>HMRC integration architecture</li>
                <li>Immutable evidence systems</li>
                <li>Multi-firm SaaS controls</li>
                <li>Stripe billing lifecycle engine</li>
              </ul>
            </div>

            <input placeholder="Firm / Practice Name" value={firmName} onChange={(e) => setFirmName(e.target.value)} style={styles.input} />
            <input placeholder="Authorised Contact Name" value={authorisedContactName} onChange={(e) => setAuthorisedContactName(e.target.value)} style={styles.input} />
            <input placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} style={styles.input} />

            <select value={professionalBody} onChange={(e) => setProfessionalBody(e.target.value)} style={styles.input}>
              <option value="">Professional Body</option>
              <option value="ACCA">ACCA</option>
              <option value="ICAEW">ICAEW</option>
              <option value="AAT">AAT</option>
              <option value="CTA">CTA</option>
              <option value="ATT">ATT</option>
              <option value="CIMA">CIMA</option>
              <option value="ICAS">ICAS</option>
              <option value="Other">Other</option>
            </select>

            <select value={practiceType} onChange={(e) => setPracticeType(e.target.value)} style={styles.input}>
              <option value="">Practice Type</option>
              <option value="Accountancy Practice">Accountancy Practice</option>
              <option value="Bookkeeping Firm">Bookkeeping Firm</option>
              <option value="Payroll Bureau">Payroll Bureau</option>
              <option value="Tax Consultancy">Tax Consultancy</option>
              <option value="Sole Practitioner">Sole Practitioner</option>
              <option value="Multi-Partner Firm">Multi-Partner Firm</option>
            </select>

            <select value={estimatedClientCount} onChange={(e) => setEstimatedClientCount(e.target.value)} style={styles.input}>
              <option value="">Estimated Client Count</option>
              <option value="1-25">1-25</option>
              <option value="26-100">26-100</option>
              <option value="101-250">101-250</option>
              <option value="251-1000">251-1000</option>
              <option value="1000+">1000+</option>
            </select>

            <input placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} style={styles.input} />
          </>
        )}

        {inviteData && (
          <div style={styles.inviteBox}>
            <p style={{ marginTop: 0 }}><strong>Invited Email:</strong> {inviteData.email}</p>
            <p style={{ marginBottom: 0 }}><strong>Role:</strong> {inviteData.role}</p>
          </div>
        )}

        {!verificationMode && (
          <>
            <input
              placeholder="Business Email"
              value={email}
              disabled={!!inviteData}
              onChange={(e) => setEmail(e.target.value)}
              style={{ ...styles.input, background: inviteData ? "#f3f4f6" : "white" }}
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
              style={{ ...styles.button, background: loading ? "#94a3b8" : "#0f172a", cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? "Creating Account..." : inviteData ? "Join Firm" : "Create Secure Account"}
            </button>
          </>
        )}

        {verificationMode && !inviteData && (
          <>
            <div style={styles.successBox}>
              <strong>Registration Created.</strong>
              <div style={{ marginTop: 8 }}>Verify your email before activating your workspace.</div>
            </div>

            {verificationUrl && (
              <div style={styles.devBox}>
                <strong>Development Verification Link:</strong>
                <div style={{ marginTop: 8, wordBreak: "break-all" }}>
                  <a href={verificationUrl}>{verificationUrl}</a>
                </div>
              </div>
            )}

            <div style={styles.planSection}>
              <h3 style={{ marginTop: 0 }}>Choose Your Plan</h3>

              {PLAN_OPTIONS.map((plan) => (
                <button
                  key={plan.slug}
                  onClick={() => setSelectedPlan(plan.slug)}
                  style={{
                    ...styles.planButton,
                    border: selectedPlan === plan.slug ? "2px solid #2563eb" : "1px solid #dbe4ee",
                    background: selectedPlan === plan.slug ? "#eff6ff" : "white",
                  }}
                >
                  <div style={styles.planHeader}>
                    <strong>{plan.title}</strong>
                    <span>{plan.price}</span>
                  </div>
                  <div style={styles.planDescription}>{plan.description}</div>
                </button>
              ))}
            </div>

            <button
              onClick={handleCheckout}
              disabled={loading}
              style={{ ...styles.button, background: loading ? "#94a3b8" : "#175cd3", cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? "Starting Checkout..." : "Continue To Secure Checkout"}
            </button>
          </>
        )}

        <p style={styles.loginText}>
          Already have an account?{" "}
          <a href={inviteToken ? `/auth/login?invite=${inviteToken}` : "/auth/login"} style={styles.loginLink}>
            Login
          </a>
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%)", padding: 40, fontFamily: "Inter, Arial, sans-serif", color: "#0f172a" },
  card: { maxWidth: 640, margin: "60px auto", background: "white", padding: 32, borderRadius: 20, border: "1px solid #e5eaf1", boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)" },
  kicker: { margin: 0, color: "#175cd3", fontSize: 12, fontWeight: 850, textTransform: "uppercase", letterSpacing: 1.2 },
  title: { margin: "8px 0 8px", fontSize: 38, lineHeight: 1.05, letterSpacing: "-0.04em" },
  subtitle: { color: "#64748b", fontSize: 15, marginBottom: 22 },
  includeBox: { background: "#ecfeff", border: "1px solid #a5f3fc", borderRadius: 12, padding: 14, marginBottom: 18 },
  inviteBox: { background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, marginBottom: 18 },
  successBox: { background: "#ecfdf3", border: "1px solid #86efac", borderRadius: 12, padding: 14, marginBottom: 18 },
  warningBox: { background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 12, padding: 14, marginBottom: 18 },
  devBox: { background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 12, padding: 14, marginBottom: 18 },
  input: { width: "100%", padding: 12, marginBottom: 12, borderRadius: 10, border: "1px solid #d1d5db", boxSizing: "border-box" },
  button: { width: "100%", padding: "13px 16px", color: "white", border: "none", borderRadius: 12, fontWeight: 850, fontSize: 15 },
  loginText: { marginTop: 18, fontSize: 14 },
  loginLink: { color: "#2563eb", fontWeight: 700 },
  planSection: { marginBottom: 18 },
  planButton: { width: "100%", textAlign: "left", borderRadius: 12, padding: 14, marginBottom: 12, cursor: "pointer" },
  planHeader: { display: "flex", justifyContent: "space-between", marginBottom: 6 },
  planDescription: { color: "#64748b", fontSize: 14 },
};
