-- ComputePay — production schema (customized from L33tSaaS pack)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',  -- free | pro | admin
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  external_id TEXT,  -- e.g. Agent-Rider rider id
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  agent_id UUID REFERENCES agents(id),
  metric TEXT NOT NULL,  -- tokens | api_calls | gpu_seconds | custom
  quantity NUMERIC NOT NULL CHECK (quantity >= 0),  -- measured amount (may be fractional); NOT money
  unit_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost_cents >= 0),  -- integer cents only
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  stripe_invoice_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),  -- integer cents only
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | open | paid | void
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE spend_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  threshold_cents INTEGER NOT NULL CHECK (threshold_cents >= 0),  -- integer cents only
  channel TEXT NOT NULL DEFAULT 'email',  -- email | slack
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_workspace_time ON usage_events(workspace_id, created_at);
CREATE INDEX idx_usage_agent ON usage_events(agent_id);
CREATE INDEX idx_invoices_workspace ON invoices(workspace_id);

-- Migration for databases created before integer-cents (NUMERIC unit_cost_cents):
--   ALTER TABLE usage_events
--     ALTER COLUMN unit_cost_cents TYPE INTEGER USING round(unit_cost_cents)::int;
--   ALTER TABLE usage_events
--     ADD CONSTRAINT usage_events_unit_cost_cents_check CHECK (unit_cost_cents >= 0);
--   ALTER TABLE usage_events
--     ADD CONSTRAINT usage_events_quantity_check CHECK (quantity >= 0);
--   ALTER TABLE invoices
--     ADD CONSTRAINT invoices_amount_cents_check CHECK (amount_cents >= 0);
--   ALTER TABLE spend_alerts
--     ADD CONSTRAINT spend_alerts_threshold_cents_check CHECK (threshold_cents >= 0);
-- Fractional-cent rows are rounded (not truncated) by the USING clause, and
-- the API boundary now rejects fractional money with 400 before insert.
