import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/** Aggregate current-month usage into a draft invoice */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { workspace_id } = body;

  if (!workspace_id) {
    return NextResponse.json(
      { ok: false, error: "workspace_id required" },
      { status: 400 }
    );
  }

  const spend = await query(
    `SELECT COALESCE(SUM(quantity * unit_cost_cents), 0)::int AS amount_cents,
            MIN(created_at) AS period_start,
            MAX(created_at) AS period_end
     FROM usage_events
     WHERE workspace_id = $1
       AND created_at >= date_trunc('month', now())`,
    [workspace_id]
  );

  if (!spend.db) {
    return NextResponse.json({
      ok: true,
      source: "memory",
      invoice: {
        id: "mem-inv-" + Date.now(),
        workspace_id,
        amount_cents: 0,
        status: "draft",
      },
    });
  }

  const amount_cents = Number(spend.rows[0]?.amount_cents || 0);
  const period_start = spend.rows[0]?.period_start;
  const period_end = spend.rows[0]?.period_end;

  const inserted = await query(
    `INSERT INTO invoices (workspace_id, amount_cents, status, period_start, period_end)
     VALUES ($1, $2, 'draft', $3, $4)
     RETURNING id, workspace_id, amount_cents, status, period_start, period_end, created_at`,
    [workspace_id, amount_cents, period_start, period_end]
  );

  return NextResponse.json({
    ok: true,
    source: "db",
    invoice: inserted.rows[0],
  });
}
