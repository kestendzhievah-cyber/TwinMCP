import { getDb } from "@/db";
import { libraries } from "@/db/schema";
import { desc } from "drizzle-orm";

export default async function LibrariesPage() {
  const db = getDb();
  const libs = await db
    .select({
      id: libraries.id,
      title: libraries.title,
      description: libraries.description,
      trustScore: libraries.trustScore,
      totalSnippets: libraries.totalSnippets,
      status: libraries.status,
      lastIndexedAt: libraries.lastIndexedAt,
    })
    .from(libraries)
    .orderBy(desc(libraries.trustScore))
    .limit(100);

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 4 }}>Libraries</h1>
      <p style={{ color: "#666", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
        {libs.length} indexed libraries
      </p>

      {libs.length === 0 ? (
        <p style={{ color: "#999" }}>
          No libraries indexed yet. Run the ingestion pipeline to populate.
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>
              <th style={th}>Library</th>
              <th style={th}>Trust</th>
              <th style={th}>Snippets</th>
              <th style={th}>Status</th>
              <th style={th}>Last indexed</th>
            </tr>
          </thead>
          <tbody>
            {libs.map((l) => (
              <tr key={l.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                <td style={td}>
                  <strong>{l.title}</strong>
                  <br />
                  <span style={{ color: "#999", fontSize: "0.75rem" }}>{l.id}</span>
                  {l.description && (
                    <>
                      <br />
                      <span style={{ color: "#888", fontSize: "0.8rem" }}>
                        {l.description.slice(0, 80)}
                      </span>
                    </>
                  )}
                </td>
                <td style={td}>{l.trustScore.toFixed(1)}</td>
                <td style={td}>{l.totalSnippets}</td>
                <td style={td}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: "0.75rem",
                      background:
                        l.status === "ready"
                          ? "#e6ffe6"
                          : l.status === "failed"
                            ? "#ffe6e6"
                            : "#fff3e0",
                      color:
                        l.status === "ready" ? "#060" : l.status === "failed" ? "#600" : "#960",
                    }}
                  >
                    {l.status}
                  </span>
                </td>
                <td style={td}>{l.lastIndexedAt ? l.lastIndexedAt.toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "6px 8px", fontWeight: 500, color: "#666" };
const td: React.CSSProperties = { padding: "8px", verticalAlign: "top" };
