import { NextResponse } from "next/server";
import { stripeEnabled, stripeWebhookConfigured } from "@/lib/stripe";

export async function GET() {
  return NextResponse.json({
    configured: stripeEnabled(),
    webhook_configured: stripeWebhookConfigured(),
    mode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live")
      ? "live"
      : "test-or-unset",
  });
}
