import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const workspace_id = new URL(req.url).searchParams.get("workspace_id");
  if (!workspace_id) {
    return NextResponse.json({ ok: false, error: "workspace_id required" }, { status: 400 });
  }
  const { rows, db } = await query(
    `SELECT id, workspace_id, threshold_cents, channel, created_at
     FROM spend_alerts WHERE workspace_id = $1 ORDER BY created_at DESC`,
    [workspace_id]
  );
  return NextResponse.json({
    budgets: db ? rows : [],
    count: db ? rows.length : 0,
    source: db ? "db" : "placeholder",
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { workspace_id, threshold_cents, channel = "email" } = body;
  if (!workspace_id || threshold_cents == null) {
    return NextResponse.json(
      { ok: false, error: "workspace_id and threshold_cents required" },
      { status: 400 }
    );
  }
  const { rows, db } = await query(
    `INSERT INTO spend_alerts (workspace_id, threshold_cents, channel)
     VALUES ($1, $2, $3)
     RETURNING id, workspace_id, threshold_cents, channel, created_at`,
    [workspace_id, threshold_cents, channel]
  );
  if (!db) {
    return NextResponse.json({
      ok: true,
      source: "memory",
      budget: { id: "mem-" + Date.now(), workspace_id, threshold_cents, channel },
    });
  }
  return NextResponse.json({ ok: true, source: "db", budget: rows[0] });
}
