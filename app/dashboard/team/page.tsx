"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

const ADMIN_ROLES = ["owner", "admin", "partner", "hala_super_admin"];

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
  const [message, setMessage] = useState("");

  const loadTeam = async () => {
    setLoading(true);
    setMessage("");

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.replace("/auth/login");
      return;
    }

    const impersonatedFirmId =
      typeof window !== "undefined"
        ? localStorage.getItem("impersonate_firm_id")
        : null;

    const { data: activeFirmId, error: firmError } = await supabase.rpc(
      "get_current_active_firm_id",
      { impersonated_firm_id: impersonatedFirmId || null }
    );

    if (firmError || !activeFirmId) {
      setMessage(firmError?.message || "No active firm access found.");
      setLoading(false);
      return;
    }

    setFirmId(String(activeFirmId));

    const { data: resolvedRole } = await supabase.rpc("get_current_firm_role", {
  impersonated_firm_id: impersonatedFirmId || null,
});

setCurrentRole(resolvedRole || "");

    const { data: firmData } = await supabase
      .from("firms")
      .select("*")
      .eq("id", activeFirmId)
      .maybeSingle();

    setFirm(firmData || null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createInvite = async (e: React.FormEvent) => {
  e.preventDefault();

  const cleanEmail = inviteEmail.trim().toLowerCase();

  if (!cleanEmail) {
    setMessage("Please enter an email address.");
    return;
  }

  if (!ADMIN_ROLES.includes(currentRole)) {
    setMessage("Only admin or partner users can invite team members.");
    return;
  }

  setCreatingInvite(true);
  setLatestInviteLink("");
  setMessage("");

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    setCreatingInvite(false);
    router.replace("/auth/login");
    return;
  }

  const impersonatedFirmId =
    typeof window !== "undefined"
      ? localStorage.getItem("impersonate_firm_id")
      : null;

  const response = await fetch("/api/team/invitations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      email: cleanEmail,
      role: inviteRole,
      impersonatedFirmId: impersonatedFirmId || null,
    }),
  });

  const result = await response.json();

  setCreatingInvite(false);

  if (!response.ok || !result.success) {
    setMessage(result.error || "Unable to create invitation.");
    return;
  }

  const link = `${window.location.origin}/join/${result.invitation.token}`;

  setLatestInviteLink(link);
  setInviteEmail("");
  setInviteRole("staff");

  if (result.reused) {
    setMessage(
      "An unused invitation already exists. Existing invite link shown below."
    );
  } else {
    setMessage("Invitation created successfully.");
  }

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
      <main style={styles.page}>
        <div style={styles.card}>Loading team...</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href="/dashboard/clients" style={styles.backLink}>
          ← Back to clients
        </Link>

        <div style={styles.hero}>
          <p style={styles.kicker}>Hala MTD Portal</p>
          <h1 style={styles.title}>Team Management</h1>
          <p style={styles.heroText}>
            {firm?.name || "Your Firm"} · Manage staff access, reviewer roles,
            partner permissions and firm invitations.
          </p>
        </div>

        {message && <div style={styles.message}>{message}</div>}

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Invite Team Member</h2>

          {!ADMIN_ROLES.includes(currentRole) ? (
            <p style={styles.warning}>
              Only admin or partner users can invite team members.
            </p>
          ) : (
            <form onSubmit={createInvite} style={styles.inviteGrid}>
              <label>
                Email address
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="staff@example.com"
                  style={styles.input}
                />
              </label>

              <label>
                Role
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  style={styles.input}
                >
                  <option value="staff">Staff</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="partner">Partner</option>
                  <option value="admin">Admin</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={creatingInvite}
                style={styles.primaryButton}
              >
                {creatingInvite ? "Creating..." : "Create Invite"}
              </button>
            </form>
          )}

          {latestInviteLink && (
            <div style={styles.successBox}>
              <p style={{ marginTop: 0, fontWeight: 800 }}>
                Invite link created. Share this manually:
              </p>

              <p style={styles.inviteLink}>{latestInviteLink}</p>

              <button
                onClick={() => copyInviteLink(latestInviteLink)}
                style={styles.smallButton}
              >
                Copy Link
              </button>
            </div>
          )}
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Current Team Members</h2>

          {teamMembers.length === 0 ? (
            <p>No team members found.</p>
          ) : (
            <table cellPadding={12} style={styles.table}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th align="left">Email</th>
                  <th align="left">User ID</th>
                  <th align="left">Role</th>
                  <th align="left">Status</th>
                  <th align="left">Joined</th>
                </tr>
              </thead>

              <tbody>
                {teamMembers.map((member) => (
                  <tr key={member.id} style={styles.tr}>
                    <td>{member.email || "Not stored"}</td>
                    <td style={{ fontSize: 12 }}>{member.user_id}</td>
                    <td>
                      <strong>{member.role}</strong>
                    </td>
                    <td>{member.status || (member.is_active ? "active" : "inactive")}</td>
                    <td>{formatDateTime(member.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Invitations</h2>

          {invitations.length === 0 ? (
            <p>No invitations created yet.</p>
          ) : (
            <table cellPadding={12} style={styles.table}>
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
                    <tr key={invite.id} style={styles.tr}>
                      <td>{invite.email}</td>
                      <td>{invite.role}</td>
                      <td>
                        {invite.accepted_at ? (
                          <span style={styles.greenBadge}>Accepted</span>
                        ) : (
                          <span style={styles.amberBadge}>Pending</span>
                        )}
                      </td>
                      <td>{formatDateTime(invite.created_at)}</td>
                      <td>
                        {invite.accepted_at ? (
                          "Used"
                        ) : (
                          <button
                            onClick={() => copyInviteLink(link)}
                            style={styles.smallButton}
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

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f6f8fb",
    padding: 40,
  },
  container: {
    maxWidth: 1100,
    margin: "0 auto",
  },
  backLink: {
    color: "#2563eb",
    fontWeight: 800,
    textDecoration: "none",
  },
  hero: {
    background: "#0f172a",
    color: "white",
    padding: 24,
    borderRadius: 18,
    marginTop: 20,
    marginBottom: 24,
  },
  kicker: {
    margin: "0 0 6px",
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: 800,
  },
  title: {
    margin: 0,
    fontSize: 34,
    fontWeight: 900,
  },
  heroText: {
    margin: "8px 0 0",
    color: "#cbd5e1",
  },
  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  sectionTitle: {
    marginTop: 0,
  },
  inviteGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 180px auto",
    gap: 12,
    alignItems: "end",
  },
  input: {
    width: "100%",
    padding: 10,
    marginTop: 6,
    border: "1px solid #d1d5db",
    borderRadius: 8,
  },
  primaryButton: {
    background: "#0f172a",
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "11px 15px",
    fontWeight: 800,
    cursor: "pointer",
  },
  smallButton: {
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "8px 11px",
    fontWeight: 800,
    cursor: "pointer",
  },
  successBox: {
    marginTop: 18,
    padding: 14,
    background: "#dcfce7",
    border: "1px solid #86efac",
    borderRadius: 10,
  },
  inviteLink: {
    background: "white",
    padding: 10,
    borderRadius: 8,
    wordBreak: "break-all",
  },
  table: {
    borderCollapse: "collapse",
    width: "100%",
    background: "white",
  },
  tr: {
    borderTop: "1px solid #e5e7eb",
  },
  greenBadge: {
    background: "#dcfce7",
    color: "#166534",
    padding: "5px 10px",
    borderRadius: 999,
    fontWeight: 800,
    fontSize: 13,
  },
  amberBadge: {
    background: "#fef3c7",
    color: "#92400e",
    padding: "5px 10px",
    borderRadius: 999,
    fontWeight: 800,
    fontSize: 13,
  },
  warning: {
    color: "#92400e",
    fontWeight: 800,
  },
  message: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 14,
    background: "#eef6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    fontWeight: 800,
  },
};