import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireWorkspaceAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = requireWorkspaceAuth(req.headers);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const { searchParams } = new URL(req.url);
  const workspace_id = searchParams.get("workspace_id");

  if (!workspace_id) {
    return NextResponse.json(
      { ok: false, error: "workspace_id required" },
      { status: 400 }
    );
  }

  const { rows, db } = await query(
    `SELECT id, workspace_id, stripe_invoice_id, amount_cents, status,
            period_start, period_end, created_at
     FROM invoices
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [workspace_id]
  );

  return NextResponse.json({
    invoices: db ? rows : [],
    count: db ? rows.length : 0,
    source: db ? "db" : "placeholder",
  });
}
