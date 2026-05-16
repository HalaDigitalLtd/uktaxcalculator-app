import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function getEnvironmentVariable(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export function createServerSupabaseClient() {
  return createClient(
    getEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"),
    getEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      global: {
        headers: {},
      },
    }
  );
}

export async function getServerAccessToken() {
  const cookieStore = await cookies();

  const authCookie = cookieStore
    .getAll()
    .find((cookie) => cookie.name.includes("sb-"));

  if (!authCookie?.value) {
    return null;
  }

  try {
    const parsed = JSON.parse(authCookie.value);

    return (
      parsed?.access_token ||
      parsed?.currentSession?.access_token ||
      null
    );
  } catch {
    return null;
  }
}

export async function getAuthenticatedServerUser() {
  const token = await getServerAccessToken();

  if (!token) {
    return null;
  }

  const supabase = createClient(
    getEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"),
    getEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY")
  );

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return null;
  }

  return data.user;
}
