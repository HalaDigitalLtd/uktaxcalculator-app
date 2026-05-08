"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function Page() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [firmId, setFirmId] = useState("");
  const [firmName, setFirmName] = useState("Your firm");
  const [userEmail, setUserEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const loadFirmContext = async () => {
    setPageLoading(true);
    setError("");

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      router.replace("/auth/login");
      return;
    }

    setUserEmail(userData.user.email || "");

    const { data: adminOk } = await supabase.rpc("is_hala_admin");
    setIsAdmin(Boolean(adminOk));

    const impersonatedFirmId =
      typeof window !== "undefined"
        ? localStorage.getItem("impersonate_firm_id")
        : null;

    const { data: resolvedFirmId, error: firmResolveError } = await supabase.rpc(
      "get_current_active_firm_id",
      {
        impersonated_firm_id: impersonatedFirmId || null,
      }
    );

    if (firmResolveError || !resolvedFirmId) {
      setError(
        Boolean(adminOk)
          ? "Admin mode active. Please select a firm from the admin control centre first."
          : firmResolveError?.message || "Firm not found for user."
      );
      setFirmId("");
      setPageLoading(false);
      return;
    }

    setFirmId(String(resolvedFirmId));

    const { data: firmData } = await supabase
      .from("firms")
      .select("name")
      .eq("id", resolvedFirmId)
      .maybeSingle();

    setFirmName(firmData?.name || "Your firm");
    setPageLoading(false);
  };

  useEffect(() => {
    loadFirmContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectHmrc = async () => {
    if (!firmId) {
      setError("Firm not resolved. Please return to dashboard and try again.");
      return;
    }

    setLoading(true);
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      router.replace("/auth/login");
      return;
    }

    const res = await fetch("/api/hmrc/connect", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firmId,
      }),
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

  if (pageLoading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-xl rounded-xl bg-white p-6 shadow">
          Loading HMRC connection page...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-xl rounded-xl bg-white p-6 shadow">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-blue-600 no-underline"
        >
          ← Back to dashboard
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-gray-900">Connect HMRC</h1>

        <p className="mt-3 text-gray-600">
          Connect this firm to HMRC sandbox so the platform can pull obligations
          and prepare MTD ITSA submissions.
        </p>

        <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          <div>
            Firm: <strong>{firmName}</strong>
          </div>
          <div>
            Firm ID: <strong>{firmId || "Not resolved"}</strong>
          </div>
          <div>
            Logged in as: <strong>{userEmail || "Unknown user"}</strong>
          </div>
          {isAdmin && (
            <div className="mt-2 font-semibold text-orange-700">
              Admin firm view active. HMRC connection will be linked to the
              selected firm.
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {isAdmin && !firmId && (
          <Link
            href="/admin/firms"
            className="mt-6 inline-flex rounded-lg bg-black px-5 py-3 text-white no-underline"
          >
            Open Admin Firms
          </Link>
        )}

        {firmId && (
          <button
            type="button"
            onClick={connectHmrc}
            disabled={loading}
            className="mt-6 rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
          >
            {loading ? "Connecting..." : "Connect HMRC"}
          </button>
        )}
      </div>
    </main>
  );
}