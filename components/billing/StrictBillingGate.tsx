"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type BillingAccessResponse = {
  success: boolean;
  allowed: boolean;
  reason?: string | null;
  firmId?: string | null;
  billingStatus?: string | null;
};

const ALWAYS_ALLOWED_PREFIXES = [
  "/auth",
  "/admin",
  "/api",
  "/thank-you",
  "/join",
  "/dashboard/settings/billing",
];

function isAllowedPath(pathname: string) {
  return ALWAYS_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function getStoredFirmId() {
  if (typeof window === "undefined") return null;

  return (
    window.localStorage.getItem("impersonate_firm_id") ||
    window.localStorage.getItem("active_firm_id") ||
    null
  );
}

function getSupabaseAccessToken() {
  if (typeof window === "undefined") return null;

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i) || "";

    if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;

    try {
      const value = JSON.parse(window.localStorage.getItem(key) || "{}");
      const token = value?.access_token || value?.currentSession?.access_token;

      if (token) return String(token);
    } catch {
      continue;
    }
  }

  return null;
}

export default function StrictBillingGate({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const shouldBypass = useMemo(() => isAllowedPath(pathname || ""), [pathname]);

  const [loading, setLoading] = useState(!shouldBypass);
  const [allowed, setAllowed] = useState(shouldBypass);

  useEffect(() => {
    if (shouldBypass) {
      setAllowed(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function checkAccess() {
      try {
        const firmId = getStoredFirmId();
        const token = getSupabaseAccessToken();

        if (!token) {
          router.replace("/dashboard/settings/billing?reason=unauthenticated");
          return;
        }

        const query = firmId ? `?firmId=${encodeURIComponent(firmId)}` : "";

        const response = await fetch(`/api/billing/access-status${query}`, {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = (await response.json()) as BillingAccessResponse;

        if (cancelled) return;

        if (data.allowed) {
          setAllowed(true);
          setLoading(false);
          return;
        }

        setAllowed(false);
        setLoading(false);

        const reason = encodeURIComponent(data.reason || "billing_required");
        router.replace(`/dashboard/settings/billing?reason=${reason}`);
      } catch {
        if (cancelled) return;

        setAllowed(false);
        setLoading(false);
        router.replace("/dashboard/settings/billing?reason=billing_check_failed");
      }
    }

    checkAccess();

    return () => {
      cancelled = true;
    };
  }, [router, shouldBypass]);

  if (loading) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        Checking firm subscription access...
      </div>
    );
  }

  if (!allowed) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        Redirecting to billing...
      </div>
    );
  }

  return <>{children}</>;
}
