"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardClientsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app/clients?view=active");
  }, [router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "24px",
          borderRadius: "18px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 10px 25px rgba(15,23,42,0.08)",
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        Redirecting to client workspace...
      </div>
    </main>
  );
}