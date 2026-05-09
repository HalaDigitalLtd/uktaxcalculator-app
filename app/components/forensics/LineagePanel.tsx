import type { CSSProperties } from "react";
import Link from "next/link";

type LineageItem = {
  label: string;
  value: any;
  href?: string;
  fallback?: string;
};

export function LineagePanel({
  items,
  reason,
}: {
  items: LineageItem[];
  reason?: string | null;
}) {
  return (
    <>
      <div style={styles.grid}>
        {items.map((item) => (
          <div key={item.label}>
            <span style={styles.label}>{item.label}</span>
            {item.href && item.value ? (
              <Link href={item.href} style={styles.link}>
                {item.value}
              </Link>
            ) : (
              <strong style={styles.value}>
                {item.value || item.fallback || "Not recorded"}
              </strong>
            )}
          </div>
        ))}
      </div>

      {reason && <p style={styles.reasonBox}>{reason}</p>}
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 14,
  },
  label: {
    display: "block",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  value: {
    display: "block",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    overflowWrap: "anywhere",
  },
  link: {
    display: "block",
    color: "#2563eb",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    overflowWrap: "anywhere",
    fontWeight: 800,
  },
  reasonBox: {
    margin: "16px 0 0",
    padding: 14,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    color: "#334155",
    fontWeight: 700,
  },
};