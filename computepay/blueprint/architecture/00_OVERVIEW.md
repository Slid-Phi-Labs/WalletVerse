# Architecture overview — ComputePay

Core domains: workspaces, agents, usage_events, invoices, budgets.

Primary integration targets: Agent-Rider, CuNi, Stripe.

Data flow: Agent/API emits usage event → meter → attribute → aggregate → invoice.
