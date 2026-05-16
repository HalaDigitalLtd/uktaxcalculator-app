import { supabaseAdmin } from "../supabaseAdmin";

const HMRC_BASE_URL =
  process.env.HMRC_BASE_URL || "https://test-api.service.hmrc.gov.uk";

type ClientTokenRow = {
  id: string;
  firm_id: string | null;
  hmrc_access_token: string | null;
  hmrc_refresh_token: string | null;
  hmrc_token_expires_at: string | null;
};

type HmrcConnectionRow = {
  id: string;
  firm_id: string | null;
  user_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  scope: string | null;
  token_type: string | null;
  expires_at: string | null;
  environment: string | null;
};

function isStillValid(expiresAt: string | null | undefined) {
  if (!expiresAt) return false;

  const expiry = new Date(expiresAt).getTime();
  const now = Date.now();

  // Keep 2 minute safety buffer.
  return expiry - now > 120_000;
}

async function refreshHmrcToken(refreshToken: string) {
  const clientId = process.env.HMRC_CLIENT_ID;
  const clientSecret = process.env.HMRC_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("HMRC_CLIENT_ID or HMRC_CLIENT_SECRET is missing");
  }

  const response = await fetch(`${HMRC_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
  });

  const text = await response.text();

  let parsed: any = null;

  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { rawResponse: text };
    }
  }

  if (!response.ok) {
    throw new Error(
      `HMRC token refresh failed: ${response.status} ${JSON.stringify(parsed)}`,
    );
  }

  if (!parsed?.access_token) {
    throw new Error("HMRC token refresh succeeded but no access_token returned");
  }

  return {
    accessToken: String(parsed.access_token),
    refreshToken: parsed.refresh_token
      ? String(parsed.refresh_token)
      : refreshToken,
    tokenType: parsed.token_type ? String(parsed.token_type) : "Bearer",
    scope: parsed.scope ? String(parsed.scope) : null,
    expiresAt: new Date(
      Date.now() + Number(parsed.expires_in || 14400) * 1000,
    ).toISOString(),
  };
}

async function getClientTokenRow(clientId: string) {
  const { data, error } = await supabaseAdmin
    .from("clients")
    .select(
      "id, firm_id, hmrc_access_token, hmrc_refresh_token, hmrc_token_expires_at",
    )
    .eq("id", clientId)
    .limit(1);

  if (error) {
    throw new Error(`Client lookup failed: ${error.message}`);
  }

  const client = (data || [])[0];

  if (!client) {
    throw new Error("Client not found");
  }

  return client as ClientTokenRow;
}

async function getLatestFirmConnection(firmId: string | null) {
  if (!firmId) return null;

  const { data, error } = await supabaseAdmin
    .from("hmrc_connections")
    .select(
      "id, firm_id, user_id, access_token, refresh_token, scope, token_type, expires_at, environment",
    )
    .eq("firm_id", firmId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`HMRC connection lookup failed: ${error.message}`);
  }

  return data as HmrcConnectionRow | null;
}

async function persistClientTokens({
  clientId,
  accessToken,
  refreshToken,
  expiresAt,
}: {
  clientId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}) {
  const { error } = await supabaseAdmin
    .from("clients")
    .update({
      hmrc_access_token: accessToken,
      hmrc_refresh_token: refreshToken,
      hmrc_token_expires_at: expiresAt,
    })
    .eq("id", clientId);

  if (error) {
    throw new Error(`Failed to persist client HMRC tokens: ${error.message}`);
  }
}

async function persistConnectionTokens({
  connectionId,
  accessToken,
  refreshToken,
  expiresAt,
  scope,
  tokenType,
}: {
  connectionId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scope: string | null;
  tokenType: string | null;
}) {
  const { error } = await supabaseAdmin
    .from("hmrc_connections")
    .update({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      scope,
      token_type: tokenType || "Bearer",
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);

  if (error) {
    throw new Error(`Failed to persist HMRC connection tokens: ${error.message}`);
  }
}

export async function getValidHmrcToken(clientId: string): Promise<string> {
  const client = await getClientTokenRow(clientId);

  if (client.hmrc_access_token && isStillValid(client.hmrc_token_expires_at)) {
    return client.hmrc_access_token;
  }

  if (client.hmrc_refresh_token) {
    const refreshed = await refreshHmrcToken(client.hmrc_refresh_token);

    await persistClientTokens({
      clientId,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: refreshed.expiresAt,
    });

    return refreshed.accessToken;
  }

  const connection = await getLatestFirmConnection(client.firm_id);

  if (connection?.access_token && isStillValid(connection.expires_at)) {
    await persistClientTokens({
      clientId,
      accessToken: connection.access_token,
      refreshToken: connection.refresh_token || "",
      expiresAt: connection.expires_at || new Date(Date.now() + 3600_000).toISOString(),
    });

    return connection.access_token;
  }

  if (connection?.refresh_token) {
    const refreshed = await refreshHmrcToken(connection.refresh_token);

    await persistConnectionTokens({
      connectionId: connection.id,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: refreshed.expiresAt,
      scope: refreshed.scope || connection.scope,
      tokenType: refreshed.tokenType || connection.token_type,
    });

    await persistClientTokens({
      clientId,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: refreshed.expiresAt,
    });

    return refreshed.accessToken;
  }

  throw new Error(
    "HMRC connection not found. Connect this client or firm to HMRC first.",
  );
}