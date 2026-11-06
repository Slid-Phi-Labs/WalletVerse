import { NextRequest, NextResponse } from "next/server";
import { isAdminConfigured, verifyAdminCode } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // Refuse closed: no default code. Without ADMIN_CODE nobody unlocks.
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { ok: false, error: "admin unlock disabled: ADMIN_CODE is not configured" },
      { status: 503 }
    );
  }
  const body = await req.json().catch(() => ({}));
  if (!verifyAdminCode(body?.code)) {
    return NextResponse.json({ ok: false, error: "invalid code" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    role: "admin",
    plan: "admin",
    billing_bypass: true,
  });
}
