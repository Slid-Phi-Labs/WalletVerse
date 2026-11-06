import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireWorkspaceAuth } from "@/lib/auth";
import { roundToCents } from "@/lib/money";
import { getStripeAdapter } from "@/lib/stripe";

/**
 * Aggregate current-month usage into a draft invoice, then create + finalize
 * the matching real Stripe invoice when STRIPE_SECRET_KEY is configured.
 * Without Stripe the invoice stays a local draft (stripe: "disabled").
 */
export async function POST(req: NextRequest) {
  const auth = requireWorkspaceAuth(req.headers);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const { workspace_id } = body;

  if (!workspace_id) {
    return NextResponse.json(
      { ok: false, error: "workspace_id required" },
      { status: 400 }
    );
  }

  const spend = await query(
    `SELECT round(COALESCE(SUM(quantity * unit_cost_cents), 0))::int AS amount_cents,
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
      stripe: "disabled",
      invoice: {
        id: "mem-inv-" + Date.now(),
        workspace_id,
        amount_cents: 0,
        status: "draft",
      },
    });
  }

  const amount_cents = roundToCents(Number(spend.rows[0]?.amount_cents || 0));
  const period_start = spend.rows[0]?.period_start;
  const period_end = spend.rows[0]?.period_end;

  const inserted = await query(
    `INSERT INTO invoices (workspace_id, amount_cents, status, period_start, period_end)
     VALUES ($1, $2, 'draft', $3, $4)
     RETURNING id, workspace_id, stripe_invoice_id, amount_cents, status, period_start, period_end, created_at`,
    [workspace_id, amount_cents, period_start, period_end]
  );
  const invoice = inserted.rows[0];

  const adapter = getStripeAdapter();
  if (!adapter) {
    return NextResponse.json({ ok: true, source: "db", stripe: "disabled", invoice });
  }

  try {
    const ref = await adapter.createAndFinalizeInvoice({
      workspaceId: workspace_id,
      amountCents: invoice.amount_cents,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
    });
    const updated = await query(
      `UPDATE invoices SET stripe_invoice_id = $1, status = $2 WHERE id = $3
       RETURNING id, workspace_id, stripe_invoice_id, amount_cents, status, period_start, period_end, created_at`,
      [ref.id, ref.status, invoice.id]
    );
    return NextResponse.json({
      ok: true,
      source: "db",
      stripe: "live",
      invoice: updated.rows[0] ?? invoice,
      stripe_invoice: ref,
    });
  } catch (err) {
    // Local draft is kept; the Stripe failure is reported, not hidden.
    return NextResponse.json(
      {
        ok: false,
        source: "db",
        stripe: "error",
        error: err instanceof Error ? err.message : "stripe invoice failed",
        invoice,
      },
      { status: 502 }
    );
  }
}
