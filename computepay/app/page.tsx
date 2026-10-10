import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.25rem" }}>
      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.75rem" }}>ComputePay</h1>
        <p style={{ color: "#8b949e", marginTop: 6 }}>
          AI & agent usage billing — meter, attribute, invoice
        </p>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <Card title="Usage ingest">
          <code style={{ fontSize: 13 }}>POST /api/usage</code>
          <div style={{ color: "#8b949e", fontSize: 13, marginTop: 6 }}>
            workspace_id, metric, quantity, unit_cost_cents
          </div>
        </Card>
        <Card title="Dashboard summary">
          <code style={{ fontSize: 13 }}>GET /api/dashboard/summary</code>
          <div style={{ color: "#8b949e", fontSize: 13, marginTop: 6 }}>
            spend_cents, events, invoices, alerts
          </div>
        </Card>
        <Card title="Invoices">
          <code style={{ fontSize: 13 }}>GET /api/invoices</code>
          <div style={{ color: "#8b949e", fontSize: 13, marginTop: 6 }}>
            POST /api/invoices/generate for draft rollup
          </div>
        </Card>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>API</h2>
        <ul style={{ color: "#8b949e", lineHeight: 1.9 }}>
          <li>
            <Link href="/api/dashboard/summary?workspace_id=demo" style={{ color: "#58a6ff" }}>
              GET /api/dashboard/summary?workspace_id=demo
            </Link>
          </li>
          <li>
            <Link href="/api/usage?workspace_id=demo" style={{ color: "#58a6ff" }}>
              GET /api/usage?workspace_id=demo
            </Link>
          </li>
          <li>
            <Link href="/api/invoices?workspace_id=demo" style={{ color: "#58a6ff" }}>
              GET /api/invoices?workspace_id=demo
            </Link>
          </li>
        </ul>
      </section>

      <footer style={{ color: "#484f58", fontSize: 13 }}>
        L33tSaaS Labs · Claimed exclusive · ComputePay
      </footer>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#161b22",
        border: "1px solid #21262d",
        borderRadius: 10,
        padding: "1rem 1.1rem",
      }}
    >
      <div style={{ color: "#8b949e", fontSize: 13, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}
