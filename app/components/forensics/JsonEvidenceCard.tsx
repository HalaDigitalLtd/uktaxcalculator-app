import type { CSSProperties } from "react";

export function JsonEvidenceCard({
  title,
  value,
  defaultOpen = true,
}: {
  title: string;
  value: any;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} style={styles.card}>
      <summary style={styles.summaryTitle}>{title}</summary>
      <pre style={styles.pre}>{JSON.stringify(value ?? {}, null, 2)}</pre>
    </details>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)",
  },
  summaryTitle: {
    cursor: "pointer",
    fontSize: 20,
    fontWeight: 900,
    marginBottom: 14,
  },
  pre: {
    margin: 0,
    padding: 16,
    background: "#0f172a",
    color: "#e5e7eb",
    borderRadius: 12,
    overflowX: "auto",
    fontSize: 12,
    lineHeight: 1.5,
    maxHeight: 620,
  },
};