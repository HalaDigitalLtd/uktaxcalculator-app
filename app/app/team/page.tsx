"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function TeamPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [firm, setFirm] = useState<any>(null);
  const [firmId, setFirmId] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [latestInviteLink, setLatestInviteLink] = useState("");

  const loadTeam = async () => {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/auth/login");
      return;
    }

    const impersonateFirmId =
      typeof window !== "undefined"
        ? localStorage.getItem("impersonate_firm_id")
        : null;

    let activeFirmId = "";
    let role = "";

    if (impersonateFirmId) {
      activeFirmId = impersonateFirmId;
      role = "owner";
    } else {
      const { data: firmUser, error: firmUserError } = await supabase
        .from("firm_users")
        .select("firm_id, role")
        .eq("user_id", userData.user.id)
        .single();

      if (firmUserError || !firmUser) {
        alert("No firm found for this user.");
        router.push("/auth/login");
        return;
      }

      activeFirmId = firmUser.firm_id;
      role = firmUser.role;
    }

    setFirmId(activeFirmId);
    setCurrentRole(role);

    const { data: firmData } = await supabase
      .from("firms")
      .select("*")
      .eq("id", activeFirmId)
      .single();

    setFirm(firmData);

    const { data: membersData } = await supabase
      .from("firm_users")
      .select("*")
      .eq("firm_id", activeFirmId)
      .order("created_at", { ascending: true });

    setTeamMembers(membersData || []);

    const { data: inviteData } = await supabase
      .from("firm_invitations")
      .select("*")
      .eq("firm_id", activeFirmId)
      .order("created_at", { ascending: false });

    setInvitations(inviteData || []);
    setLoading(false);
  };

  useEffect(() => {
    loadTeam();
  }, []);

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = inviteEmail.trim().toLowerCase();

    if (!cleanEmail) {
      alert("Please enter an email address.");
      return;
    }

    if (currentRole !== "owner") {
      alert("Only firm owners can invite team members.");
      return;
    }

    setCreatingInvite(true);
    setLatestInviteLink("");

    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("firm_invitations")
      .insert({
        firm_id: firmId,
        email: cleanEmail,
        role: inviteRole,
        created_by: userData.user?.id || null,
      })
      .select()
      .single();

    setCreatingInvite(false);

    if (error) {
      alert(error.message);
      return;
    }

    const link = `${window.location.origin}/join/${data.token}`;
    setLatestInviteLink(link);
    setInviteEmail("");
    setInviteRole("staff");

    await loadTeam();
  };

  const copyInviteLink = async (link: string) => {
    await navigator.clipboard.writeText(link);
    alert("Invite link copied.");
  };

  const getInviteLink = (token: string) => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join/${token}`;
  };

  const formatDateTime = (value: string) => {
    if (!value) return "";
    return new Date(value).toLocaleString("en-GB");
  };

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#f6f8fb", padding: 40 }}>
        Loading team...
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f6f8fb", padding: 40 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link href="/app/clients" style={{ color: "#2563eb" }}>
          ← Back to clients
        </Link>

        <div
          style={{
            background: "#0f172a",
            color: "white",
            padding: 24,
            borderRadius: 16,
            marginTop: 20,
            marginBottom: 24,
          }}
        >
          <p style={{ margin: "0 0 6px", color: "#94a3b8", fontSize: 14 }}>
            Hala MTD Portal
          </p>

          <h1 style={{ margin: 0 }}>Team Management</h1>

          <p style={{ margin: "8px 0 0", color: "#cbd5e1" }}>
            {firm?.name || "Your Firm"} · Invite staff to work on the same MTD
            client workspace.
          </p>
        </div>

        <section style={sectionStyle}>
          <h2 style={{ marginTop: 0 }}>Invite Team Member</h2>

          {currentRole !== "owner" ? (
            <p style={{ color: "#92400e", fontWeight: 700 }}>
              Only firm owners can invite team members.
            </p>
          ) : (
            <form
              onSubmit={createInvite}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 180px auto",
                gap: 12,
                alignItems: "end",
              }}
            >
              <label>
                Email address
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="staff@example.com"
                  style={inputStyle}
                />
              </label>

              <label>
                Role
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  style={inputStyle}
                >
                  <option value="staff">Staff</option>
                  <option value="owner">Owner</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={creatingInvite}
                style={{
                  background: creatingInvite ? "#94a3b8" : "#0f172a",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "11px 15px",
                  fontWeight: 700,
                  cursor: creatingInvite ? "not-allowed" : "pointer",
                }}
              >
                {creatingInvite ? "Creating..." : "Create Invite"}
              </button>
            </form>
          )}

          {latestInviteLink && (
            <div
              style={{
                marginTop: 18,
                padding: 14,
                background: "#dcfce7",
                border: "1px solid #86efac",
                borderRadius: 10,
              }}
            >
              <p style={{ marginTop: 0, fontWeight: 700 }}>
                Invite link created. Share this manually with the team member:
              </p>

              <p
                style={{
                  background: "white",
                  padding: 10,
                  borderRadius: 8,
                  wordBreak: "break-all",
                }}
              >
                {latestInviteLink}
              </p>

              <button
                onClick={() => copyInviteLink(latestInviteLink)}
                style={smallButton}
              >
                Copy Link
              </button>
            </div>
          )}
        </section>

        <section style={sectionStyle}>
          <h2 style={{ marginTop: 0 }}>Current Team Members</h2>

          {teamMembers.length === 0 ? (
            <p>No team members found.</p>
          ) : (
            <table cellPadding={12} style={tableStyle}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th align="left">User ID</th>
                  <th align="left">Role</th>
                  <th align="left">Joined</th>
                </tr>
              </thead>

              <tbody>
                {teamMembers.map((member) => (
                  <tr key={member.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ fontSize: 13 }}>{member.user_id}</td>
                    <td>
                      <strong>{member.role}</strong>
                    </td>
                    <td>{formatDateTime(member.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section style={sectionStyle}>
          <h2 style={{ marginTop: 0 }}>Invitations</h2>

          {invitations.length === 0 ? (
            <p>No invitations created yet.</p>
          ) : (
            <table cellPadding={12} style={tableStyle}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th align="left">Email</th>
                  <th align="left">Role</th>
                  <th align="left">Status</th>
                  <th align="left">Created</th>
                  <th align="left">Invite Link</th>
                </tr>
              </thead>

              <tbody>
                {invitations.map((invite) => {
                  const link = getInviteLink(invite.token);

                  return (
                    <tr key={invite.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td>{invite.email}</td>
                      <td>{invite.role}</td>
                      <td>
                        {invite.accepted_at ? (
                          <span style={greenBadge}>Accepted</span>
                        ) : (
                          <span style={amberBadge}>Pending</span>
                        )}
                      </td>
                      <td>{formatDateTime(invite.created_at)}</td>
                      <td>
                        {invite.accepted_at ? (
                          "Used"
                        ) : (
                          <button
                            onClick={() => copyInviteLink(link)}
                            style={smallButton}
                          >
                            Copy Link
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}

const sectionStyle = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 24,
  marginBottom: 24,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const inputStyle = {
  width: "100%",
  padding: 10,
  marginTop: 6,
  border: "1px solid #d1d5db",
  borderRadius: 8,
};

const tableStyle = {
  borderCollapse: "collapse" as const,
  width: "100%",
  background: "white",
};

const smallButton = {
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 8,
  padding: "8px 11px",
  fontWeight: 700,
  cursor: "pointer",
};

const greenBadge = {
  background: "#dcfce7",
  color: "#166534",
  padding: "5px 10px",
  borderRadius: 999,
  fontWeight: 700,
  fontSize: 13,
};

const amberBadge = {
  background: "#fef3c7",
  color: "#92400e",
  padding: "5px 10px",
  borderRadius: 999,
  fontWeight: 700,
  fontSize: 13,
};