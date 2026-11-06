import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  getStripeAdapter,
  setStripeAdapterForTests,
  stripeEnabled,
  verifyStripeWebhookSignature,
  type StripeAdapter,
} from "../lib/stripe.ts";

const SECRET = "whsec_test_123";
const T = 1700000000;
const NOW_MS = T * 1000;

function invoiceBody(id = "in_123"): string {
  return JSON.stringify({
    id: "evt_1",
    type: "invoice.paid",
    data: { object: { object: "invoice", id } },
  });
}

function sign(body: string, secret: string, t: number): string {
  const sig = createHmac("sha256", secret).update(`${t}.${body}`, "utf8").digest("hex");
  return `t=${t},v1=${sig}`;
}

const savedKey = process.env.STRIPE_SECRET_KEY;
const savedWh = process.env.STRIPE_WEBHOOK_SECRET;

beforeEach(() => {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  setStripeAdapterForTests(undefined);
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = savedKey;
  if (savedWh === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = savedWh;
  setStripeAdapterForTests(undefined);
});

describe("webhook signature verification (offline)", () => {
  it("accepts a correctly signed event and extracts the invoice id", () => {
    const body = invoiceBody();
    const res = verifyStripeWebhookSignature(body, sign(body, SECRET, T), SECRET, NOW_MS);
    assert.equal(res.ok, true);
    assert.equal(res.ok ? res.event.type : "", "invoice.paid");
    assert.equal(res.ok ? res.event.invoiceId : "", "in_123");
  });

  it("accepts non-invoice events with a null invoice id", () => {
    const body = JSON.stringify({ id: "evt_2", type: "ping", data: { object: null } });
    const res = verifyStripeWebhookSignature(body, sign(body, SECRET, T), SECRET, NOW_MS);
    assert.equal(res.ok, true);
    assert.equal(res.ok ? res.event.invoiceId : "x", null);
  });

  it("rejects tampered payloads and wrong secrets", () => {
    const body = invoiceBody();
    const header = sign(body, SECRET, T);
    assert.equal(verifyStripeWebhookSignature(body + " ", header, SECRET, NOW_MS).ok, false);
    assert.equal(verifyStripeWebhookSignature(body, header, "whsec_other", NOW_MS).ok, false);
  });

  it("rejects missing, malformed, and stale signatures", () => {
    const body = invoiceBody();
    assert.equal(verifyStripeWebhookSignature(body, null, SECRET, NOW_MS).ok, false);
    assert.equal(verifyStripeWebhookSignature(body, "garbage", SECRET, NOW_MS).ok, false);
    assert.equal(
      verifyStripeWebhookSignature(body, `t=${T},v1=zz`, SECRET, NOW_MS).ok,
      false
    );
    const stale = sign(body, SECRET, T);
    assert.equal(
      verifyStripeWebhookSignature(body, stale, SECRET, (T + 301) * 1000).ok,
      false
    );
    const edge = sign(body, SECRET, T);
    assert.equal(
      verifyStripeWebhookSignature(body, edge, SECRET, (T + 300) * 1000).ok,
      true
    );
  });

  it("rejects bad payloads even with a valid signature", () => {
    const notJson = "not json";
    assert.equal(
      verifyStripeWebhookSignature(notJson, sign(notJson, SECRET, T), SECRET, NOW_MS).ok,
      false
    );
    const noType = JSON.stringify({ id: "evt_3" });
    assert.equal(
      verifyStripeWebhookSignature(noType, sign(noType, SECRET, T), SECRET, NOW_MS).ok,
      false
    );
  });

  it("refuses closed when the webhook secret is unset", () => {
    const body = invoiceBody();
    const res = verifyStripeWebhookSignature(body, sign(body, SECRET, T), "", NOW_MS);
    assert.equal(res.ok, false);
  });
});

describe("env-gated injectable adapter", () => {
  it("is offline (null) without STRIPE_SECRET_KEY", () => {
    assert.equal(stripeEnabled(), false);
    assert.equal(getStripeAdapter(), null);
  });

  it("returns the real adapter when the key is set, without importing stripe", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    assert.equal(stripeEnabled(), true);
    const adapter = getStripeAdapter();
    assert.ok(adapter);
    assert.equal(typeof adapter?.createAndFinalizeInvoice, "function");
  });

  it("honors the injected test adapter", async () => {
    const fake: StripeAdapter = {
      createAndFinalizeInvoice: async (draft) => ({
        id: "in_fake_1",
        status: "open",
        hostedInvoiceUrl: null,
        customerId: "cus_fake",
      }),
    };
    setStripeAdapterForTests(fake);
    assert.equal(getStripeAdapter(), fake);
    const ref = await getStripeAdapter()?.createAndFinalizeInvoice({
      workspaceId: "ws_1",
      amountCents: 250,
    });
    assert.deepEqual(ref, {
      id: "in_fake_1",
      status: "open",
      hostedInvoiceUrl: null,
      customerId: "cus_fake",
    });
    setStripeAdapterForTests(null);
    assert.equal(getStripeAdapter(), null);
  });
});
