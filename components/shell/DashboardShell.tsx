import DashboardSidebar from "../navigation/DashboardSidebar";
import DashboardTopbar from "../navigation/DashboardTopbar";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f7f9fc 0%, #eef3f9 100%)",
        display: "flex",
      }}
    >
      <DashboardSidebar />

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <DashboardTopbar />

        <main
          style={{
            flex: 1,
            padding: "18px 20px 24px",
          }}
        >
          <div
            style={{
              maxWidth: 1440,
              margin: "0 auto",
              width: "100%",
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
