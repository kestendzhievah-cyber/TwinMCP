const plans = [
  {
    name: "Free",
    price: "$0",
    features: ["50 requests/day", "Public libraries only", "Community support"],
    cta: "Get started",
    href: "/sign-up",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$20/mo",
    features: ["1,000 requests/day", "Public libraries", "Priority support", "API key management"],
    cta: "Upgrade to Pro",
    href: "/sign-up",
    highlighted: true,
  },
  {
    name: "Team",
    price: "$50/mo",
    features: [
      "5,000 requests/day",
      "Public + private libraries",
      "Teamspace & policies",
      "Member management",
      "Priority support",
    ],
    cta: "Contact us",
    href: "/sign-up",
    highlighted: false,
  },
];

export default function PlansPage() {
  return (
    <main
      style={{
        maxWidth: 900,
        margin: "60px auto",
        padding: "0 1rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "2rem", textAlign: "center", marginBottom: 8 }}>Plans & Pricing</h1>
      <p style={{ textAlign: "center", color: "#666", marginBottom: "3rem" }}>
        Documentation context for AI coding agents.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
        {plans.map((p) => (
          <div
            key={p.name}
            style={{
              border: p.highlighted ? "2px solid #111" : "1px solid #eee",
              borderRadius: 12,
              padding: 24,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h2 style={{ fontSize: "1.25rem", marginBottom: 4 }}>{p.name}</h2>
            <p style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 16 }}>{p.price}</p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, flex: 1 }}>
              {p.features.map((f) => (
                <li key={f} style={{ padding: "4px 0", fontSize: "0.85rem", color: "#555" }}>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href={p.href}
              style={{
                marginTop: 20,
                display: "block",
                textAlign: "center",
                padding: "10px 0",
                borderRadius: 6,
                textDecoration: "none",
                fontSize: "0.9rem",
                background: p.highlighted ? "#111" : "#fff",
                color: p.highlighted ? "#fff" : "#111",
                border: "1px solid #ddd",
              }}
            >
              {p.cta}
            </a>
          </div>
        ))}
      </div>
    </main>
  );
}
