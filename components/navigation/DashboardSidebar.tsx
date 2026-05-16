"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/dashboard/clients", label: "Clients" },
      { href: "/dashboard/hmrc-connect", label: "HMRC Connections" },
      { href: "/dashboard/team", label: "Team" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/dashboard/forensics", label: "Forensics" },
      { href: "/dashboard/settings/billing", label: "Billing" },
      { href: "/dashboard/settings", label: "Settings" },
    ],
  },
];

export default function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 290,
        background: "#07111f",
        color: "white",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        padding: 24,
      }}
    >
      <div style={{ marginBottom: 34 }}>
        <p
          style={{
            fontSize: 12,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#67e8f9",
            marginBottom: 8,
            fontWeight: 800,
          }}
        >
          Hala Digital
        </p>

        <h2
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 900,
          }}
        >
          Practice OS
        </h2>

        <p
          style={{
            color: "#94a3b8",
            marginTop: 10,
            lineHeight: 1.6,
            fontSize: 14,
          }}
        >
          Accountant-grade MTD ITSA operating platform.
        </p>
      </div>

      <div style={{ flex: 1 }}>
        {navItems.map((section) => (
          <div key={section.title} style={{ marginBottom: 28 }}>
            <p
              style={{
                color: "#64748b",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 12,
                fontWeight: 700,
              }}
            >
              {section.title}
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {section.items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 14,
                      textDecoration: "none",
                      color: active ? "#07111f" : "#e2e8f0",
                      background: active
                        ? "#67e8f9"
                        : "transparent",
                      fontWeight: active ? 800 : 600,
                      transition: "0.2s ease",
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingTop: 18,
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 18,
            padding: 16,
          }}
        >
          <strong
            style={{
              display: "block",
              marginBottom: 8,
            }}
          >
            Production SaaS
          </strong>

          <p
            style={{
              margin: 0,
              color: "#94a3b8",
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            HMRC workflows, evidence controls, billing enforcement and practice operations.
          </p>
        </div>
      </div>
    </aside>
  );
}

