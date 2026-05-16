export default function DashboardQueueItem({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status?: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #edf2f7",
        borderRadius: 16,
        padding: "14px 16px",
        background: "#fcfdff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 750,
              color: "#101828",
              marginBottom: 6,
              lineHeight: 1.3,
            }}
          >
            {title}
          </div>

          <div
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: "#667085",
            }}
          >
            {description}
          </div>
        </div>

        {status && (
          <div
            style={{
              whiteSpace: "nowrap",
              borderRadius: 999,
              padding: "5px 10px",
              fontSize: 11,
              fontWeight: 800,
              background: "#f2f4f7",
              color: "#344054",
            }}
          >
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
