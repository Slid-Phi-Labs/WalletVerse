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

  const spend = await query(
    `SELECT round(COALESCE(SUM(quantity * unit_cost_cents), 0))::bigint AS spend_cents,
            COUNT(*)::int AS event_count
     FROM usage_events
     WHERE workspace_id = $1
       AND created_at >= date_trunc('month', now())`,
    [workspace_id]
  );

  const invoices = await query(
    `SELECT id, amount_cents, status, period_start, period_end, created_at
     FROM invoices
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT 5`,
    [workspace_id]
  );

  const alerts = await query(
    `SELECT id, threshold_cents, channel FROM spend_alerts WHERE workspace_id = $1`,
    [workspace_id]
  );

  const spend_cents = spend.db ? Number(spend.rows[0]?.spend_cents || 0) : 0;
  const event_count = spend.db ? Number(spend.rows[0]?.event_count || 0) : 0;

  return NextResponse.json({
    workspace_id,
    period: "current_month",
    spend_cents,
    event_count,
    invoices: invoices.db ? invoices.rows : [],
    alerts: alerts.db ? alerts.rows : [],
    source: spend.db ? "db" : "placeholder",
  });
}
