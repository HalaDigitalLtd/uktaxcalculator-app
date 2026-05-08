import { supabase } from "./supabaseClient";

export async function authenticatedFetch(
  input: RequestInfo,
  init: RequestInit = {}
) {
  const { data } = await supabase.auth.getSession();

  const token = data?.session?.access_token;

  if (!token) {
    throw new Error("Authentication session expired.");
  }

  return fetch(input, {
    ...init,
    headers: {
      ...(init.headers || {}),
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}