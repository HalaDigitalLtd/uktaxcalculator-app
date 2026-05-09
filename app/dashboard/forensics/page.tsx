export default function ForensicsDashboardPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: 32,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            marginBottom: 28,
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              color: "#64748b",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontSize: 12,
            }}
          >
            HMRC FORENSIC OPERATIONS
          </p>

          <h1
            style={{
              margin: 0,
              fontSize: 42,
              fontWeight: 900,
              color: "#0f172a",
            }}
          >
            Forensic Control Centre
          </h1>

          <p
            style={{
              marginTop: 14,
              maxWidth: 900,
              color: "#475569",
              lineHeight: 1.7,
              fontSize: 16,
            }}
          >
            Global forensic monitoring for immutable HMRC
            evidence, amendment lineage, replay risk,
            digital-link compliance and operational
            investigation workflows.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 18,
            marginBottom: 28,
          }}
        >
          {[
            "Critical Alerts",
            "Evidence Gaps",
            "Replay Risks",
            "Digital Link Failures",
            "High Risk Amendments",
            "Tamper Risk Flags",
          ].map((item) => (
            <div
              key={item}
              style={{
                background: "white",
                borderRadius: 20,
                padding: 22,
                border: "1px solid #e2e8f0",
                boxShadow:
                  "0 10px 30px rgba(15,23,42,0.06)",
              }}
            >
              <div
                style={{
                  color: "#64748b",
                  fontSize: 13,
                  fontWeight: 800,
                  marginBottom: 12,
                  textTransform: "uppercase",
                }}
              >
                {item}
              </div>

              <div
                style={{
                  fontSize: 34,
                  fontWeight: 900,
                  color: "#0f172a",
                }}
              >
                --
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: "white",
            borderRadius: 24,
            border: "1px solid #e2e8f0",
            padding: 28,
            boxShadow:
              "0 10px 30px rgba(15,23,42,0.06)",
          }}
        >
          <h2
            style={{
              marginTop: 0,
              fontSize: 24,
              fontWeight: 900,
              color: "#0f172a",
            }}
          >
            Operational Investigation Feed
          </h2>

          <p
            style={{
              marginBottom: 0,
              color: "#64748b",
              lineHeight: 1.7,
            }}
          >
            Global immutable evidence investigation queue
            will appear here in the next implementation
            phase.
          </p>
        </div>
      </div>
    </main>
  );
}