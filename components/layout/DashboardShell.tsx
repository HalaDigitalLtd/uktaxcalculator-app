"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
};

const navItems = [
  {
    label: "Clients",
    href: "/dashboard/clients",
  },
  {
    label: "Team",
    href: "/dashboard/team",
  },
  {
    label: "Billing",
    href: "/dashboard/settings/billing",
  },
  {
    label: "HMRC",
    href: "/dashboard/hmrc-connect",
  },
  {
    label: "Forensics",
    href: "/dashboard/forensics",
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
  },
];

export default function DashboardShell({
  children,
  title,
  subtitle,
}: Props) {
  const pathname = usePathname();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "280px 1fr",
        background: "#f8fafc",
      }}
    >
      <aside
        style={{
          background: "#020617",
          color: "white",
          padding: 24,
          borderRight: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ marginBottom: 30 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "#93c5fd",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Hala Digital
          </p>

          <h1
            style={{
              margin: "8px 0 0",
              fontSize: 28,
              lineHeight: 1.1,
            }}
          >
            Accountant OS
          </h1>

          <p
            style={{
              color: "#94a3b8",
              fontSize: 14,
              lineHeight: 1.6,
              marginTop: 12,
            }}
          >
            HMRC workflows, MTD ITSA operations, evidence systems and accountant practice management.
          </p>
        </div>

        <nav
          style={{
            display: "grid",
            gap: 8,
          }}
        >
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "12px 14px",
                  borderRadius: 14,
                  textDecoration: "none",
                  background: active
                    ? "rgba(37,99,235,.18)"
                    : "transparent",
                  color: active ? "#bfdbfe" : "#e2e8f0",
                  border: active
                    ? "1px solid rgba(59,130,246,.35)"
                    : "1px solid transparent",
                  fontWeight: 700,
                  transition: "all .15s ease",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div
          style={{
            marginTop: "auto",
            paddingTop: 24,
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 18,
              padding: 18,
            }}
          >
            <p
              style={{
                margin: 0,
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              Production SaaS
            </p>

            <p
              style={{
                marginTop: 10,
                marginBottom: 0,
                color: "#94a3b8",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              Enterprise-grade accountant workflow platform with immutable evidence architecture.
            </p>
          </div>
        </div>
      </aside>

      <main
        style={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        <header
          style={{
            background: "rgba(255,255,255,.92)",
            backdropFilter: "blur(10px)",
            borderBottom: "1px solid #e2e8f0",
            padding: "22px 32px",
            position: "sticky",
            top: 0,
            zIndex: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 18,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 28,
                  color: "#0f172a",
                }}
              >
                {title || "Workspace"}
              </h2>

              {subtitle && (
                <p
                  style={{
                    margin: "8px 0 0",
                    color: "#64748b",
                    lineHeight: 1.6,
                    maxWidth: 920,
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  background: "#dcfce7",
                  color: "#166534",
                  padding: "10px 14px",
                  borderRadius: 999,
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                Billing Active
              </div>

              <div
                style={{
                  background: "#dbeafe",
                  color: "#1d4ed8",
                  padding: "10px 14px",
                  borderRadius: 999,
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                HMRC Sandbox
              </div>
            </div>
          </div>
        </header>

        <div
          style={{
            padding: 32,
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
