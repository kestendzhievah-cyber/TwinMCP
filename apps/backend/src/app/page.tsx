export default function HomePage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "3rem", margin: 0 }}>TwinMCP</h1>
      <p style={{ color: "#666", marginTop: "1rem" }}>
        Documentation context for AI coding agents.
      </p>
      <p style={{ color: "#999", marginTop: "2rem", fontSize: "0.875rem" }}>
        Backend scaffold — Phase 0.
      </p>
    </main>
  );
}
