type Tone = "green" | "amber" | "red" | "blue" | "slate";

function toneStyles(tone: Tone) {
  if (tone === "red") {
    return {
      accent: "#dc2626",
      soft: "#fef2f2",
      border: "#fecaca",
    };
  }

  if (tone === "amber") {
    return {
      accent: "#d97706",
      soft: "#fffbeb",
      border: "#fde68a",
    };
  }

  if (tone === "green") {
    return {
      accent: "#059669",
      soft: "#ecfdf5",
      border: "#a7f3d0",
    };
  }

  if (tone === "blue") {
    return {
      accent: "#2563eb",
      soft: "#eff6ff",
      border: "#bfdbfe",
    };
  }

  return {
    accent: "#475569",
    soft: "#f8fafc",
    border: "#e2e8f0",
  };
}

export default function DashboardMetricCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: number | string;
  helper: string;
  tone: Tone;
}) {
  const colours = toneStyles(tone);

  return (
    <div
      style={{
        background: "rgba(255,255,255,.86)",
        border: "1px solid #e5e7eb",
        borderRadius: 24,
        padding: 22,
        boxShadow: "0 10px 30px rgba(15,23,42,.05)",
        backdropFilter: "blur(10px)",
        minHeight: 150,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: 999,
            padding: "7px 10px",
            background: colours.soft,
            border: `1px solid ${colours.border}`,
            color: colours.accent,
            fontSize: 12,
            fontWeight: 850,
          }}
        >
          {label}
        </span>

        <div
          style={{
            marginTop: 18,
            fontSize: 42,
            lineHeight: 1,
            fontWeight: 950,
            letterSpacing: -1.5,
            color: "#0f172a",
          }}
        >
          {value}
        </div>
      </div>

      <p
        style={{
          margin: "14px 0 0",
          color: "#64748b",
          fontSize: 14,
          lineHeight: 1.55,
        }}
      >
        {helper}
      </p>
    </div>
  );
}
