"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const ADMIN_EMAILS = ["ikramzaman@gmail.com", "ikramzaman+test4@gmail.com"];

export default function AppRootPage() {
  const router = useRouter();

  useEffect(() => {
    const handleRouting = async () => {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push("/auth/login");
        return;
      }

      const email = userData.user.email?.toLowerCase() || "";

      // Admin → admin panel
      if (ADMIN_EMAILS.includes(email)) {
        router.push("/admin/firms");
        return;
      }

      // Normal user → clients dashboard
      router.push("/app/clients");
    };

    handleRouting();
  }, [router]);

  return (
    <main style={{ padding: 40 }}>
      Redirecting...
    </main>
  );
}