import type { CSSProperties } from "react";

export function ImmutableBanner() {
  return (
    <div style={styles.headerActions}>
      <span style={styles.lockPill}>Immutable</span>
      <span style={styles.lockPill}>Read-only</span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  headerActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  lockPill: {
    display: "inline-flex",
    padding: "10px 12px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#3730a3",
    border: "1px solid #c7d2fe",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
  },
};