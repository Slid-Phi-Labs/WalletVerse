import { NextResponse } from "next/server";
import { stripeEnabled } from "@/lib/stripe";

export async function GET() {
  return NextResponse.json({
    configured: stripeEnabled(),
    mode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live")
      ? "live"
      : "test-or-unset",
  });
}
