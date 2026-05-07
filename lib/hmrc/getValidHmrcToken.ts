import { supabaseAdmin } from "../supabaseAdmin";

export async function getValidHmrcToken(firmId: string) {
  const { data: connection, error } = await supabaseAdmin
    .from("hmrc_connections")
    .select("*")
    .eq("firm_id", firmId)
    .eq("environment", process.env.HMRC_ENVIRONMENT || "sandbox")
    .single();

  if (error || !connection) {
    throw new Error("HMRC connection not found");
  }

  const expiresAt = new Date(connection.expires_at).getTime();
  const now = Date.now();

  const fiveMinutes = 5 * 60 * 1000;

  if (expiresAt - now > fiveMinutes) {
    return connection.access_token;
  }

  const refreshResponse = await fetch(process.env.HMRC_TOKEN_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.HMRC_CLIENT_ID || "",
      client_secret: process.env.HMRC_CLIENT_SECRET || "",
      refresh_token: connection.refresh_token,
    }),
  });

  const refreshData = await refreshResponse.json();

  if (!refreshResponse.ok) {
    console.error("HMRC refresh failed:", refreshData);

    throw new Error("Failed to refresh HMRC token");
  }

  const newExpiresAt = new Date(
    Date.now() + refreshData.expires_in * 1000
  ).toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("hmrc_connections")
    .update({
      access_token: refreshData.access_token,
      refresh_token:
        refreshData.refresh_token || connection.refresh_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  if (updateError) {
    console.error("HMRC token save failed:", updateError);

    throw new Error("Failed to save refreshed HMRC token");
  }

  return refreshData.access_token;
}