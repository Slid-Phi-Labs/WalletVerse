import type Stripe from "stripe";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stripe loop for ComputePay.
 *
 * - Env-gated: no STRIPE_SECRET_KEY means the adapter is offline (null) and
 *   invoice generation stays a local draft. Nothing pretends to bill.
 * - Injectable: tests (and local harnesses) override the adapter with
 *   setStripeAdapterForTests without touching the network.
 * - Webhooks are verified with HMAC-SHA256 per Stripe's signature scheme
 *   using only node:crypto, so verification works offline and in tests.
 */

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripeWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

export interface InvoiceDraft {
  workspaceId: string;
  amountCents: number;
  currency?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
}

export interface StripeInvoiceRef {
  id: string;
  status: string;
  hostedInvoiceUrl?: string | null;
  customerId?: string | null;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  /** Stripe invoice id when the event object is an invoice, else null. */
  invoiceId: string | null;
}

export interface StripeAdapter {
  createAndFinalizeInvoice(draft: InvoiceDraft): Promise<StripeInvoiceRef>;
}

export type WebhookVerifyResult =
  | { ok: true; event: StripeWebhookEvent }
  | { ok: false; error: string };

export const WEBHOOK_TOLERANCE_SECONDS = 300;

/**
 * Verify a Stripe webhook signature header against the raw request body.
 * Pure function of (body, header, secret, now) — no network, fully testable.
 */
export function verifyStripeWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret?: string,
  nowMs?: number
): WebhookVerifyResult {
  const key = secret ?? process.env.STRIPE_WEBHOOK_SECRET;
  if (!key) {
    return { ok: false, error: "stripe webhook secret not configured" };
  }
  if (!signature) {
    return { ok: false, error: "missing stripe-signature header" };
  }

  const fields = signature.split(",");
  let timestamp: string | undefined;
  const candidates: string[] = [];
  for (const field of fields) {
    const eq = field.indexOf("=");
    if (eq < 0) continue;
    const name = field.slice(0, eq).trim();
    const value = field.slice(eq + 1).trim();
    if (name === "t") timestamp = value;
    else if (name === "v1" && value !== "") candidates.push(value);
  }
  if (!timestamp || !/^\d+$/.test(timestamp) || candidates.length === 0) {
    return { ok: false, error: "malformed stripe-signature header" };
  }

  const nowSec = Math.floor((nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowSec - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) {
    return { ok: false, error: "webhook timestamp outside tolerance" };
  }

  const expected = createHmac("sha256", key)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const matched = candidates.some((sig) => {
    const sigBuf = Buffer.from(sig, "utf8");
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  });
  if (!matched) {
    return { ok: false, error: "invalid webhook signature" };
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { ok: false, error: "webhook payload is not valid JSON" };
  }
  if (!payload || typeof payload.type !== "string") {
    return { ok: false, error: "webhook payload missing event type" };
  }
  const obj = payload?.data?.object;
  const invoiceId =
    obj && obj.object === "invoice" && typeof obj.id === "string" ? obj.id : null;
  return {
    ok: true,
    event: {
      id: typeof payload.id === "string" ? payload.id : "",
      type: payload.type,
      invoiceId,
    },
  };
}

async function loadStripeClient(): Promise<Stripe> {
  const mod = (await import("stripe")) as unknown as {
    default: new (key: string, opts: Record<string, string>) => Stripe;
  };
  const Ctor = mod.default ?? (mod as unknown as new (key: string, opts: Record<string, string>) => Stripe);
  return new Ctor(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2024-06-20",
  });
}

/** Real adapter: customer + invoice item + invoice + finalize. */
const realAdapter: StripeAdapter = {
  async createAndFinalizeInvoice(draft: InvoiceDraft): Promise<StripeInvoiceRef> {
    const stripe = await loadStripeClient();
    const customer = await stripe.customers.create({
      metadata: { workspace_id: draft.workspaceId },
    });
    const period =
      draft.periodStart || draft.periodEnd
        ? `${draft.periodStart ?? ""} – ${draft.periodEnd ?? ""}`.trim()
        : "current period";
    await stripe.invoiceItems.create({
      customer: customer.id,
      amount: draft.amountCents,
      currency: draft.currency ?? "usd",
      description: `ComputePay usage (${period})`,
    });
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      auto_advance: true,
      metadata: { workspace_id: draft.workspaceId },
    });
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
    return {
      id: finalized.id,
      status: finalized.status ?? "open",
      hostedInvoiceUrl: finalized.hosted_invoice_url ?? null,
      customerId: customer.id,
    };
  },
};

let testOverride: StripeAdapter | null | undefined = undefined;

/** Test/local harness hook: undefined clears the override. */
export function setStripeAdapterForTests(
  adapter: StripeAdapter | null | undefined
): void {
  testOverride = adapter;
}

/** Null when Stripe is not configured — callers must handle the offline path. */
export function getStripeAdapter(): StripeAdapter | null {
  if (testOverride !== undefined) return testOverride;
  if (!stripeEnabled()) return null;
  return realAdapter;
}
