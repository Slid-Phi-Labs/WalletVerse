import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireWorkspaceAuth } from "@/lib/auth";
import { checkIntegerCents, isNonNegativeAmount } from "@/lib/money";

/** POST /api/usage — ingest a usage event (workspace auth + integer-cents money) */
export async function POST(req: NextRequest) {
  const auth = requireWorkspaceAuth(req.headers);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const {
    workspace_id,
    agent_id,
    metric = "tokens",
    quantity,
    unit_cost_cents = 0,
    meta = {},
  } = body;

  if (!workspace_id || quantity == null) {
    return NextResponse.json(
      { ok: false, error: "workspace_id and quantity required" },
      { status: 400 }
    );
  }

  if (!isNonNegativeAmount(quantity)) {
    return NextResponse.json(
      { ok: false, error: "quantity must be a finite number >= 0" },
      { status: 400 }
    );
  }

  const cents = checkIntegerCents(unit_cost_cents, "unit_cost_cents");
  if (!cents.ok) {
    return NextResponse.json({ ok: false, error: cents.error }, { status: 400 });
  }

  const { rows, db } = await query(
    `INSERT INTO usage_events (workspace_id, agent_id, metric, quantity, unit_cost_cents, meta)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, workspace_id, agent_id, metric, quantity, unit_cost_cents, created_at`,
    [workspace_id, agent_id || null, metric, quantity, cents.value, JSON.stringify(meta)]
  );

  if (!db) {
    // No DB — accept and echo for local/dev
    return NextResponse.json({
      ok: true,
      source: "memory",
      event: {
        id: "mem-" + Date.now(),
        workspace_id,
        agent_id,
        metric,
        quantity,
        unit_cost_cents: cents.value,
        created_at: new Date().toISOString(),
      },
    });
  }

  return NextResponse.json({ ok: true, source: "db", event: rows[0] });
}

/** GET /api/usage — query usage by workspace / agent / period */
export async function GET(req: NextRequest) {
  const auth = requireWorkspaceAuth(req.headers);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const workspace_id = searchParams.get("workspace_id");
  const agent_id = searchParams.get("agent_id");
  const limit = Math.min(Number(searchParams.get("limit") || 50), 200);

  if (!workspace_id) {
    return NextResponse.json(
      { ok: false, error: "workspace_id required" },
      { status: 400 }
    );
  }

  let sql = `SELECT id, workspace_id, agent_id, metric, quantity, unit_cost_cents, meta, created_at
             FROM usage_events WHERE workspace_id = $1`;
  const params: any[] = [workspace_id];

  if (agent_id) {
    params.push(agent_id);
    sql += ` AND agent_id = $${params.length}`;
  }
  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const { rows, db } = await query(sql, params);

  return NextResponse.json({
    events: db ? rows : [],
    count: db ? rows.length : 0,
    source: db ? "db" : "placeholder",
  });
}
