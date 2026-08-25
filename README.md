# ComputePay — AI & Agent Usage Billing

**L33tSaaS Labs · Smart Frame Certified · SFv1 · SF-1 · L/C/D**  
**Status:** Claimed exclusive · Scaffold in progress (2026-08-25)

## Idea
Usage-based billing and payment orchestration for AI compute and agent apps:
- Meter tokens / API calls / GPU seconds
- Attribute cost per team and per agent
- Invoice automatically via Stripe
- Single credits-and-cash dashboard with spend alerts

Ties directly to live Agent-Rider.

## Stack
- Next.js (App Router)
- Postgres / Neon
- Stripe (Checkout + webhooks)
- Admin unlock via owner code

## Quick start
```bash
npm install
# set DATABASE_URL, STRIPE_SECRET_KEY, ADMIN_CODE
npm run dev
```

## Admin unlock
`POST /api/admin/unlock` with `{ "code": "..." }` → role=admin, plan=admin, billing_bypass=true

## Schema
See `schema.sql` (customized production schema).

## Blueprint origin
From L33tSaaS pack `computepay-ai-agent-usage-billing` (claimed in saas-agent-vault).
