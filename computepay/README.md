# ComputePay

**L33tSaaS Labs · Claimed exclusive**

AI & agent usage billing: meter tokens/API/GPU, attribute per workspace & agent, invoice, collect via Stripe.

## Status (v0)
- Schema ready (users, workspaces, agents, usage_events, invoices, spend_alerts)
- Admin unlock ready
- Core API routes:
  - `POST /api/usage` — ingest event
  - `GET /api/usage` — query events
  - `GET /api/dashboard/summary` — spend + invoices + alerts
  - `GET /api/invoices`
  - `POST /api/invoices/generate` — monthly rollup → draft invoice
  - `POST /api/admin/unlock`
- Minimal dashboard UI
- Stripe deps present; test-mode wiring next

## Quick start
```bash
cp .env.example .env.local
npm install
psql $DATABASE_URL -f schema.sql
npm run dev
```

## Env
```
DATABASE_URL=
ADMIN_CODE=change-me-in-production
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```
