"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

function SettingsContent() {
  const searchParams = useSearchParams();
  const hmrcStatus = searchParams.get("hmrc");

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const syncObligations = async () => {
    try {
      setSyncing(true);
      setSyncResult(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setSyncResult({
          success: false,
          error: "You are not logged in. Please login again.",
        });
        setSyncing(false);
        return;
      }

      setSyncResult({
        success: false,
        error:
          "For security, sync obligations from the client page only. Open the client and click Sync HMRC.",
      });
    } catch (error: any) {
      setSyncResult({
        success: false,
        error: error?.message || "Sync failed.",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link
            href="/dashboard/clients"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Back to Clients
          </Link>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">Settings</h1>

          <p className="mt-1 text-sm text-slate-600">
            Manage HMRC connection and firm-level MTD settings.
          </p>
        </div>

        {hmrcStatus === "connected" && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">
            HMRC connected successfully.
          </div>
        )}

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                HMRC Connection
              </h2>

              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Use HMRC Connect to authorise the firm. Obligation sync should
                be run from each client record so the client, firm, NINO and
                audit trail remain securely linked.
              </p>
            </div>

            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
              Sandbox
            </span>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <Link
              href="/dashboard/hmrc-connect"
              className="rounded-xl bg-slate-900 px-5 py-3 text-center text-sm font-semibold text-white"
            >
              Reconnect HMRC
            </Link>

            <button
              type="button"
              onClick={syncObligations}
              disabled={syncing}
              className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {syncing ? "Checking..." : "Sync HMRC Obligations"}
            </button>

            <Link
              href="/dashboard/clients"
              className="rounded-xl border border-slate-300 px-5 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Clients
            </Link>
          </div>

          {syncResult && (
            <div
              className={`mt-6 rounded-xl border p-4 ${
                syncResult.success
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <h3
                className={`font-bold ${
                  syncResult.success ? "text-green-800" : "text-red-800"
                }`}
              >
                {syncResult.success ? "Sync completed" : "Action required"}
              </h3>

              <p
                className={`mt-1 text-sm ${
                  syncResult.success ? "text-green-700" : "text-red-700"
                }`}
              >
                {syncResult.message || syncResult.error || "Finished."}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 p-8">
          <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            Loading settings...
          </div>
        </main>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}