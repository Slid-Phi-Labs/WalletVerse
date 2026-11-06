# ComputePay

**L33tSaaS Labs · Claimed exclusive**

AI & agent usage billing: meter tokens/API/GPU, attribute per workspace & agent, invoice, collect via Stripe.

## Status (v0)
- Schema ready (users, workspaces, agents, usage_events, invoices, spend_alerts)
- Admin unlock ready (refuses closed without `ADMIN_CODE`)
- Core API routes:
  - `POST /api/usage` — ingest event (auth + integer-cents)
  - `GET /api/usage` — query events (auth)
  - `GET /api/dashboard/summary` — spend + invoices + alerts (auth)
  - `GET /api/invoices` (auth)
  - `POST /api/invoices/generate` — monthly rollup → draft invoice, then create + finalize in Stripe when configured (auth)
  - `POST /api/admin/unlock`
  - `POST /api/stripe/webhook` — verified Stripe events update invoice status
  - `GET /api/stripe/status` — key/webhook wiring status
- Minimal dashboard UI
- Stripe: env-gated live adapter + injectable test adapter; offline `node --test` suites in `tests/`

## Trust rules
- No default admin code: `POST /api/admin/unlock` answers `503` until `ADMIN_CODE` is set.
- Every money route requires `Authorization: Bearer <WORKSPACE_API_KEY>` and answers `503` until the key is set.
- All money is integer cents. Fractional or negative amounts are rejected with `400`; aggregates round to whole cents.
- Without `STRIPE_SECRET_KEY`, invoice generation stays a local draft and reports `stripe: "disabled"` — it never pretends to bill.

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
ADMIN_CODE=
WORKSPACE_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

## Tests
```bash
npm test
```
