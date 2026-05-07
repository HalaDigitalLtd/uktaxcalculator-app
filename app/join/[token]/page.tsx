"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function JoinFirmPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<any>(null);
  const [firm, setFirm] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [joining, setJoining] = useState(false);

  const ensureFirmUserLink = async (inviteData: any, userData: any) => {
    if (!inviteData || !userData) return false;

    const loggedInEmail = userData.email?.trim().toLowerCase();
    const inviteEmail = inviteData.email?.trim().toLowerCase();

    if (loggedInEmail !== inviteEmail) {
      return false;
    }

    const { data: existingLinks } = await supabase
      .from("firm_users")
      .select("*")
      .eq("firm_id", inviteData.firm_id)
      .eq("user_id", userData.id)
      .limit(1);

    if (existingLinks && existingLinks.length > 0) {
      return true;
    }

    const { error: linkError } = await supabase.from("firm_users").insert({
      firm_id: inviteData.firm_id,
      user_id: userData.id,
      role: inviteData.role || "staff",
    });

    if (linkError && !linkError.message.toLowerCase().includes("duplicate")) {
      alert(linkError.message);
      return false;
    }

    return true;
  };

  const loadInvite = async () => {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const currentUser = userData.user || null;
    setUser(currentUser);

    const { data: inviteData, error } = await supabase
      .from("firm_invitations")
      .select("*")
      .eq("token", token)
      .single();

    if (error || !inviteData) {
      setInvite(null);
      setLoading(false);
      return;
    }

    setInvite(inviteData);

    const { data: firmData } = await supabase
      .from("firms")
      .select("*")
      .eq("id", inviteData.firm_id)
      .single();

    setFirm(firmData || null);

    if (inviteData.accepted_at && currentUser) {
      const repaired = await ensureFirmUserLink(inviteData, currentUser);

      if (repaired) {
        window.location.href = "/app/clients";
        return;
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (token) loadInvite();
  }, [token]);

  const acceptInvite = async () => {
    if (!user) {
      alert("Please login or register first using the invited email address.");
      return;
    }

    if (!invite) return;

    const loggedInEmail = user.email?.trim().toLowerCase();
    const inviteEmail = invite.email?.trim().toLowerCase();

    if (loggedInEmail !== inviteEmail) {
      alert(
        `This invite is for ${invite.email}. Please login using that email address.`
      );
      return;
    }

    setJoining(true);

    const linked = await ensureFirmUserLink(invite, user);

    if (!linked) {
      setJoining(false);
      return;
    }

    if (!invite.accepted_at) {
      const { error: inviteUpdateError } = await supabase
        .from("firm_invitations")
        .update({
          accepted_at: new Date().toISOString(),
          accepted_by: user.id,
        })
        .eq("id", invite.id);

      if (inviteUpdateError) {
        alert(inviteUpdateError.message);
        setJoining(false);
        return;
      }
    }

    setJoining(false);

    alert("Invite accepted. You now have access to the firm workspace.");
    window.location.href = "/app/clients";
  };

  const goToLogin = () => {
    window.location.href = `/auth/login?invite=${token}`;
  };

  const goToRegister = () => {
    window.location.href = `/auth/register?invite=${token}`;
  };

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#f6f8fb", padding: 40 }}>
        Loading invite...
      </main>
    );
  }

  if (!invite) {
    return (
      <main style={{ minHeight: "100vh", background: "#f6f8fb", padding: 40 }}>
        <div style={cardStyle}>
          <h1>Invite not found</h1>

          <p style={{ color: "#555" }}>
            This invite link is invalid or no longer available.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f6f8fb", padding: 40 }}>
      <div style={cardStyle}>
        <p style={{ margin: "0 0 6px", color: "#64748b", fontSize: 14 }}>
          Hala MTD Portal
        </p>

        <h1 style={{ marginTop: 0 }}>Join Firm Workspace</h1>

        <p style={{ color: "#555" }}>You have been invited to join:</p>

        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <p>
            <strong>Firm:</strong> {firm?.name || "Firm"}
          </p>

          <p>
            <strong>Invite email:</strong> {invite.email}
          </p>

          <p>
            <strong>Role:</strong> {invite.role}
          </p>

          <p>
            <strong>Status:</strong>{" "}
            {invite.accepted_at ? "Already accepted" : "Pending"}
          </p>
        </div>

        {user ? (
          <>
            <p style={{ color: "#555" }}>
              Logged in as <strong>{user.email}</strong>
            </p>

            <button
              onClick={acceptInvite}
              disabled={joining}
              style={{
                ...darkButton,
                background: joining ? "#94a3b8" : "#0f172a",
                cursor: joining ? "not-allowed" : "pointer",
              }}
            >
              {joining
                ? "Joining..."
                : invite.accepted_at
                ? "Continue to Firm"
                : "Accept Invite"}
            </button>
          </>
        ) : (
          <>
            <p style={{ color: "#92400e", fontWeight: 700 }}>
              Please login or create an account using the invited email address.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href={`/auth/login?invite=${token}`} style={darkLinkButton}>
  Login
</a>

<a href={`/auth/register?invite=${token}`} style={blueLinkButton}>
  Register
</a>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

const cardStyle = {
  maxWidth: 560,
  margin: "80px auto",
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 28,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const darkButton = {
  background: "#0f172a",
  color: "white",
  border: "none",
  borderRadius: 8,
  padding: "11px 16px",
  fontWeight: 700,
  cursor: "pointer",
};

const blueButton = {
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 8,
  padding: "11px 16px",
  fontWeight: 700,
  cursor: "pointer",
};
const darkLinkButton = {
  background: "#0f172a",
  color: "white",
  border: "none",
  borderRadius: 8,
  padding: "11px 16px",
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
};

const blueLinkButton = {
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 8,
  padding: "11px 16px",
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
};