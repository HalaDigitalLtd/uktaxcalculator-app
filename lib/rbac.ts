import { NextRequest } from "next/server";
import { supabaseAdmin } from "./supabaseAdmin";

export type FirmRole =
  | "staff"
  | "reviewer"
  | "partner"
  | "admin"
  | "owner"
  | "hala_super_admin";

export type Permission =
  | "client:create"
  | "client:update"
  | "client:archive"
  | "client:delete"
  | "quarter:prepare"
  | "quarter:import"
  | "workflow:approve"
  | "workflow:reject"
  | "workflow:lock"
  | "workflow:unlock"
  | "hmrc:submit_final"
  | "hmrc:submit_amendment"
  | "team:view"
  | "team:invite"
  | "team:update_role"
  | "team:disable"
  | "firm:settings";

const ROLE_LEVEL: Record<FirmRole, number> = {
  staff: 10,
  reviewer: 20,
  partner: 30,
  admin: 40,
  owner: 50,
  hala_super_admin: 100,
};

const ROLE_PERMISSIONS: Record<FirmRole, Permission[]> = {
  staff: [
    "client:create",
    "client:update",
    "quarter:prepare",
    "quarter:import",
    "team:view",
  ],

  reviewer: [
    "client:create",
    "client:update",
    "quarter:prepare",
    "quarter:import",
    "workflow:approve",
    "workflow:reject",
    "team:view",
  ],

  partner: [
    "client:create",
    "client:update",
    "client:archive",
    "quarter:prepare",
    "quarter:import",
    "workflow:approve",
    "workflow:reject",
    "workflow:lock",
    "workflow:unlock",
    "hmrc:submit_final",
    "hmrc:submit_amendment",
    "team:view",
  ],

  admin: [
    "client:create",
    "client:update",
    "client:archive",
    "client:delete",
    "quarter:prepare",
    "quarter:import",
    "workflow:approve",
    "workflow:reject",
    "workflow:lock",
    "workflow:unlock",
    "hmrc:submit_final",
    "hmrc:submit_amendment",
    "team:view",
    "team:invite",
    "team:update_role",
    "team:disable",
    "firm:settings",
  ],

  owner: [
    "client:create",
    "client:update",
    "client:archive",
    "client:delete",
    "quarter:prepare",
    "quarter:import",
    "workflow:approve",
    "workflow:reject",
    "workflow:lock",
    "workflow:unlock",
    "hmrc:submit_final",
    "hmrc:submit_amendment",
    "team:view",
    "team:invite",
    "team:update_role",
    "team:disable",
    "firm:settings",
  ],

  hala_super_admin: [
    "client:create",
    "client:update",
    "client:archive",
    "client:delete",
    "quarter:prepare",
    "quarter:import",
    "workflow:approve",
    "workflow:reject",
    "workflow:lock",
    "workflow:unlock",
    "hmrc:submit_final",
    "hmrc:submit_amendment",
    "team:view",
    "team:invite",
    "team:update_role",
    "team:disable",
    "firm:settings",
  ],
};

export class RbacError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "RbacError";
    this.status = status;
  }
}

export function isFirmRole(value: unknown): value is FirmRole {
  return (
    value === "staff" ||
    value === "reviewer" ||
    value === "partner" ||
    value === "admin" ||
    value === "owner" ||
    value === "hala_super_admin"
  );
}

export function roleMeetsMinimum(
  userRole: FirmRole | null | undefined,
  minimumRole: FirmRole
) {
  if (!userRole) return false;
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minimumRole];
}

export function roleHasPermission(
  userRole: FirmRole | null | undefined,
  permission: Permission
) {
  if (!userRole) return false;
  return ROLE_PERMISSIONS[userRole]?.includes(permission) ?? false;
}

export function assertDifferentUsers(actorUserId: string, targetUserId: string) {
  if (actorUserId === targetUserId) {
    throw new RbacError("You cannot perform this action on your own user record.", 400);
  }
}

export async function getAuthenticatedUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new RbacError("Missing authentication token.", 401);
  }

  const token = authHeader.replace("Bearer ", "").trim();

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    throw new RbacError("Invalid or expired authentication token.", 401);
  }

  return user;
}

export async function resolveActiveFirmId(
  userId: string,
  impersonatedFirmId?: string | null
) {
  if (impersonatedFirmId) {
    return impersonatedFirmId;
  }

  const { data, error } = await supabaseAdmin
    .from("firm_users")
    .select("firm_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new RbacError(
      `Unable to resolve active firm: ${error.message}`,
      403
    );
  }

  if (!data?.firm_id) {
    throw new RbacError(
      "No active firm membership found for this user.",
      403
    );
  }

  return data.firm_id as string;
}

export async function getFirmUserRole(userId: string, firmId: string) {
  const { data, error } = await supabaseAdmin
    .from("firm_users")
    .select("role, is_active, status")
    .eq("firm_id", firmId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new RbacError(`Unable to check firm role: ${error.message}`, 403);
  }

  const role = data?.role;

  if (!isFirmRole(role)) {
    return null;
  }

  return role;
}

export async function requireFirmRole(params: {
  userId: string;
  firmId: string;
  minimumRole: FirmRole;
}) {
  const role = await getFirmUserRole(params.userId, params.firmId);

  if (!roleMeetsMinimum(role, params.minimumRole)) {
    throw new RbacError(
      `Access denied. This action requires ${params.minimumRole} access or above.`,
      403
    );
  }

  return role;
}

export async function requireFirmPermission(params: {
  userId: string;
  firmId: string;
  permission: Permission;
}) {
  const role = await getFirmUserRole(params.userId, params.firmId);

  if (!roleHasPermission(role, params.permission)) {
    throw new RbacError(
      `Access denied. Missing permission: ${params.permission}.`,
      403
    );
  }

  return role;
}

export async function requireRequestFirmPermission(params: {
  request: NextRequest;
  permission: Permission;
  impersonatedFirmId?: string | null;
}) {
  const user = await getAuthenticatedUserFromRequest(params.request);

  const firmId = await resolveActiveFirmId(
    user.id,
    params.impersonatedFirmId ?? null
  );

  const role = await requireFirmPermission({
    userId: user.id,
    firmId,
    permission: params.permission,
  });

  return {
    user,
    firmId,
    role,
  };
}

export function rbacErrorResponse(error: unknown) {
  if (error instanceof RbacError) {
    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: error.status }
    );
  }

  return Response.json(
    {
      success: false,
      error: error instanceof Error ? error.message : "Unexpected RBAC error.",
    },
    { status: 500 }
  );
}