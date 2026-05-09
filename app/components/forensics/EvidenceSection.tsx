import type { CSSProperties, ReactNode } from "react";

export function EvidenceSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={styles.card}>
      <h2 style={styles.cardTitle}>{title}</h2>
      {children}
    </section>
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
  cardTitle: {
    margin: "0 0 14px",
    fontSize: 20,
    fontWeight: 900,
  },
};