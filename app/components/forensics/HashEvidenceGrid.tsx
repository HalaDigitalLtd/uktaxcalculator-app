import type { CSSProperties } from "react";

export function HashEvidenceGrid({
  items,
}: {
  items: { label: string; value: any }[];
}) {
  return (
    <div style={styles.grid}>
      {items.map((item) => (
        <div key={item.label}>
          <span style={styles.label}>{item.label}</span>
          <strong style={styles.hash}>{item.value || "Not recorded"}</strong>
        </div>
      ))}
    </div>
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
  hash: {
    display: "block",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    overflowWrap: "anywhere",
  },
};