"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

export default function ImpersonatePage() {
  const params = useParams();
  const firmId = params.firmId as string;

  useEffect(() => {
    if (firmId) {
      // store selected firm
      localStorage.setItem("impersonate_firm_id", firmId);

      // redirect to normal dashboard
      window.location.href = "/app/clients";
    }
  }, [firmId]);

  return (
    <div style={{ padding: 40 }}>
      <h1>Opening firm...</h1>
    </div>
  );
}