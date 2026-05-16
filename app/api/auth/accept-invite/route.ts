import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

function cleanEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const email = cleanEmail(body.email);
    const password = String(body.password || "");
    const inviteToken = String(body.inviteToken || "").trim();

    if (!email || !password || !inviteToken) {
      return NextResponse.json(
        { success: false, message: "Missing required fields." },
        { status: 400 }
      );
    }

    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from("firm_invitations")
      .select("*")
      .eq("token", inviteToken)
      .maybeSingle();

    if (inviteError || !invitation) {
      return NextResponse.json(
        { success: false, message: "Invalid invitation." },
        { status: 404 }
      );
    }

    if (invitation.accepted_at) {
      return NextResponse.json(
        { success: false, message: "Invitation already accepted." },
        { status: 409 }
      );
    }

    if (cleanEmail(invitation.email) !== email) {
      return NextResponse.json(
        { success: false, message: "Invitation email mismatch." },
        { status: 403 }
      );
    }

    const { data: authUser, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createUserError || !authUser.user) {
      return NextResponse.json(
        {
          success: false,
          message: createUserError?.message || "Unable to create invited user.",
        },
        { status: 500 }
      );
    }

    const userId = authUser.user.id;
    const now = new Date().toISOString();

    const { error: membershipError } = await supabaseAdmin
      .from("firm_users")
      .upsert(
        {
          firm_id: invitation.firm_id,
          user_id: userId,
          email,
          role: invitation.role || "staff",
          is_active: true,
          status: "active",
          invited_by: invitation.created_by || null,
          approved_by: invitation.created_by || null,
          updated_at: now,
          meta: {
            source: "backend_invite_acceptance",
            invitation_id: invitation.id,
            accepted_at: now,
          },
        },
        { onConflict: "firm_id,user_id" }
      );

    if (membershipError) {
      return NextResponse.json(
        { success: false, message: membershipError.message },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from("firm_invitations")
      .update({
        accepted_at: now,
        accepted_by: userId,
      })
      .eq("id", invitation.id);

    return NextResponse.json({
      success: true,
      firmId: invitation.firm_id,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Unexpected error." },
      { status: 500 }
    );
  }
}
