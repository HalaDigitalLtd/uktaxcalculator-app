import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import {
  isFirmRole,
  requireRequestFirmPermission,
  rbacErrorResponse,
  type FirmRole,
} from "../../../../lib/rbac";

const INVITABLE_ROLES: FirmRole[] = ["staff", "reviewer", "partner", "admin"];

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "staff").trim();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (!isFirmRole(role) || !INVITABLE_ROLES.includes(role)) {
      return NextResponse.json(
        { success: false, error: "Invalid invitation role." },
        { status: 400 }
      );
    }

    const impersonatedFirmId =
      typeof body.impersonatedFirmId === "string"
        ? body.impersonatedFirmId
        : null;

    const { user, firmId, role: actorRole } =
      await requireRequestFirmPermission({
        request,
        permission: "team:invite",
        impersonatedFirmId,
      });

    if (role === "admin" && actorRole !== "admin" && actorRole !== "owner" && actorRole !== "hala_super_admin") {
      return NextResponse.json(
        {
          success: false,
          error: "Only admin, owner or Hala super admin users can invite another admin.",
        },
        { status: 403 }
      );
    }

    const { data: existingMember, error: existingMemberError } =
      await supabaseAdmin
        .from("firm_users")
        .select("id, status, is_active")
        .eq("firm_id", firmId)
        .eq("email", email)
        .maybeSingle();

    if (existingMemberError) {
      return NextResponse.json(
        { success: false, error: existingMemberError.message },
        { status: 500 }
      );
    }

    if (existingMember?.is_active && existingMember?.status === "active") {
      return NextResponse.json(
        { success: false, error: "This user is already an active team member." },
        { status: 409 }
      );
    }

    const { data: existingInvite, error: existingInviteError } =
      await supabaseAdmin
        .from("firm_invitations")
        .select("id, token, email, role, accepted_at")
        .eq("firm_id", firmId)
        .eq("email", email)
        .is("accepted_at", null)
        .maybeSingle();

    if (existingInviteError) {
      return NextResponse.json(
        { success: false, error: existingInviteError.message },
        { status: 500 }
      );
    }

    if (existingInvite) {
      return NextResponse.json({
        success: true,
        invitation: existingInvite,
        reused: true,
      });
    }

    const token = crypto.randomUUID();

    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from("firm_invitations")
      .insert({
        firm_id: firmId,
        email,
        role,
        token,
        created_by: user.id,
      })
      .select("id, token, email, role, created_at, accepted_at")
      .single();

    if (inviteError) {
      return NextResponse.json(
        { success: false, error: inviteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      invitation,
      reused: false,
    });
  } catch (error) {
    return rbacErrorResponse(error);
  }
}