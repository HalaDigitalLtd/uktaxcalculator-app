import { supabaseAdmin } from "../supabaseAdmin";

export async function getAuthenticatedUserFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader) {
    throw new Error("Missing authorization header");
  }

  const token = authHeader.replace("Bearer ", "");

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return user;
}

export async function isHalaAdmin(email?: string | null) {
  if (!email) return false;

  const { data } = await supabaseAdmin
    .from("app_admins")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  return Boolean(data?.id);
}

export async function getUserFirmIds(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("firm_users")
    .select("firm_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => row.firm_id);
}

export async function assertClientAccess(params: {
  userId: string;
  userEmail?: string | null;
  clientId: string;
  allowHalaAdmin?: boolean;
}) {
  const { userId, userEmail, clientId, allowHalaAdmin = true } = params;

  const { data: client, error } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (error || !client) {
    throw new Error("Client not found");
  }

  const firmIds = await getUserFirmIds(userId);
  const admin = allowHalaAdmin ? await isHalaAdmin(userEmail) : false;

  if (!admin && !firmIds.includes(client.firm_id)) {
    throw new Error("Access denied for this client");
  }

  return client;
}

export async function assertTaxYearAccess(params: {
  userId: string;
  userEmail?: string | null;
  clientId: string;
  taxYearId: string;
  allowHalaAdmin?: boolean;
}) {
  const client = await assertClientAccess({
    userId: params.userId,
    userEmail: params.userEmail,
    clientId: params.clientId,
    allowHalaAdmin: params.allowHalaAdmin,
  });

  const { data: taxYear, error } = await supabaseAdmin
    .from("tax_years")
    .select("*")
    .eq("id", params.taxYearId)
    .eq("client_id", params.clientId)
    .eq("firm_id", client.firm_id)
    .maybeSingle();

  if (error || !taxYear) {
    throw new Error("Tax year not found or does not belong to this client");
  }

  return { client, taxYear };
}

export async function assertQuarterAccess(params: {
  userId: string;
  userEmail?: string | null;
  quarterId: string;
  allowHalaAdmin?: boolean;
}) {
  const { data: quarter, error } = await supabaseAdmin
    .from("quarters")
    .select("*, tax_years(*)")
    .eq("id", params.quarterId)
    .maybeSingle();

  if (error || !quarter || !quarter.tax_years) {
    throw new Error("Quarter not found");
  }

  const taxYear = quarter.tax_years;

  const client = await assertClientAccess({
    userId: params.userId,
    userEmail: params.userEmail,
    clientId: taxYear.client_id,
    allowHalaAdmin: params.allowHalaAdmin,
  });

  if (
    quarter.firm_id !== client.firm_id ||
    taxYear.firm_id !== client.firm_id
  ) {
    throw new Error("Security error: quarter/tax year/client firm mismatch");
  }

  return { quarter, taxYear, client };
}