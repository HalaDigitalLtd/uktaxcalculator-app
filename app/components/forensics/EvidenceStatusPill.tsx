import type { CSSProperties } from "react";

export function EvidenceStatusPill({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return <span style={ok ? styles.passPill : styles.warnPill}>{ok ? "✓" : "!"} {label}</span>;
}

const styles: Record<string, CSSProperties> = {
  passPill: {
    display: "inline-flex",
    padding: "8px 10px",
    borderRadius: 999,
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #10b981",
    fontSize: 12,
    fontWeight: 900,
  },
  warnPill: {
    display: "inline-flex",
    padding: "8px 10px",
    borderRadius: 999,
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #f59e0b",
    fontSize: 12,
    fontWeight: 900,
  },
};