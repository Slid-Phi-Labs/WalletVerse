import { NextRequest, NextResponse } from "next/server";
import { stripeWebhookConfigured, verifyStripeWebhookSignature } from "@/lib/stripe";
import { query } from "@/lib/db";

function statusForEventType(type: string): string | null {
  switch (type) {
    case "invoice.paid":
      return "paid";
    case "invoice.finalized":
    case "invoice.payment_failed":
      return "open";
    case "invoice.voided":
    case "invoice.marked_uncollectible":
      return "void";
    default:
      return null;
  }
}

/** POST /api/stripe/webhook — verified Stripe events update local invoice status. */
export async function POST(req: NextRequest) {
  if (!stripeWebhookConfigured()) {
    return NextResponse.json(
      { ok: false, error: "stripe webhook not configured (STRIPE_WEBHOOK_SECRET is not set)" },
      { status: 503 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();
  const verified = verifyStripeWebhookSignature(rawBody, signature);
  if (!verified.ok) {
    return NextResponse.json({ ok: false, error: verified.error }, { status: 400 });
  }

  const { event } = verified;
  const status = statusForEventType(event.type);
  if (status && event.invoiceId) {
    await query(`UPDATE invoices SET status = $1 WHERE stripe_invoice_id = $2`, [
      status,
      event.invoiceId,
    ]);
  }

  return NextResponse.json({
    ok: true,
    received: true,
    type: event.type,
    invoice_id: event.invoiceId,
    status,
  });
}
