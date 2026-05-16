"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardTheme as t } from "../../lib/dashboardTheme";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/clients", label: "Clients" },
  { href: "/dashboard/hmrc-connect", label: "HMRC" },
  { href: "/dashboard/team", label: "Team" },
  { href: "/dashboard/forensics", label: "Forensics" },
  { href: "/dashboard/settings/billing", label: "Billing" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      width: 232,
      minWidth: 232,
      height: "100vh",
      position: "sticky",
      top: 0,
      background: "linear-gradient(180deg,#f8fafc 0%, #edf3f8 100%)",
      color: t.text,
      padding: 18,
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
      borderRight: `1px solid ${t.sidebarBorder}`,
    }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{
          width: 38,
          height: 38,
          borderRadius: 14,
          background: "linear-gradient(135deg,#dbeafe,#cffafe)",
          color: "#0f4c81",
          display: "grid",
          placeItems: "center",
          fontWeight: 950,
          marginBottom: 14,
          boxShadow: "0 8px 20px rgba(37,99,235,.10)",
        }}>H</div>

        <p style={{ margin: 0, color: "#64748b", fontSize: 11, fontWeight: 850, letterSpacing: 1.4, textTransform: "uppercase" }}>
          Hala Digital
        </p>

        <h1 style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>
          Practice OS
        </h1>

        <p style={{ margin: "9px 0 0", color: t.muted, fontSize: 12, lineHeight: 1.55 }}>
          MTD ITSA operations, evidence and billing.
        </p>
      </div>

      <nav style={{ display: "grid", gap: 4 }}>
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link key={item.href} href={item.href} style={{
              textDecoration: "none",
              color: active ? "#0f172a" : "#475569",
              background: active ? "#ffffff" : "transparent",
              border: active ? "1px solid #dbe4ee" : "1px solid transparent",
              boxShadow: active ? "0 8px 20px rgba(15,23,42,.05)" : "none",
              padding: "9px 11px",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: active ? 850 : 650,
            }}>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{
        marginTop: "auto",
        padding: 12,
        borderRadius: 16,
        background: "rgba(255,255,255,.76)",
        border: "1px solid #dfe7f1",
      }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 850 }}>Secure beta</p>
        <p style={{ margin: "5px 0 0", color: t.muted, fontSize: 11, lineHeight: 1.45 }}>
          Controlled accountant SaaS workspace.
        </p>
      </div>
    </aside>
  );
}
