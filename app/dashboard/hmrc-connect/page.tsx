"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const connectHmrc = async () => {
    setLoading(true);
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      window.location.href = "/auth/login";
      return;
    }

    const res = await fetch("/api/hmrc/connect", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const text = await res.text();

let data: any = {};
try {
  data = text ? JSON.parse(text) : {};
} catch {
  data = {};
}

    if (!res.ok || !data.authUrl) {
      setError(data.error || "Failed to start HMRC connection");
      setLoading(false);
      return;
    }

    window.location.href = data.authUrl;
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-xl rounded-xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold text-gray-900">Connect HMRC</h1>

        <p className="mt-3 text-gray-600">
          Connect your firm to HMRC sandbox so we can pull obligations and prepare MTD ITSA submissions.
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={connectHmrc}
          disabled={loading}
          className="mt-6 rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
        >
          {loading ? "Connecting..." : "Connect HMRC"}
        </button>
      </div>
    </main>
  );
}