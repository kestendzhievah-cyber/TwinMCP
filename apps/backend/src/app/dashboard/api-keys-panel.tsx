"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Key {
  id: string;
  prefix: string;
  name: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export function ApiKeysPanel({ keys }: { keys: Key[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  async function createKey() {
    setCreating(true);
    const res = await fetch("/api/v2/auth/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newKeyName || undefined }),
    });
    if (res.ok) {
      const data = await res.json();
      setRevealedKey(data.key);
      setNewKeyName("");
      router.refresh();
    }
    setCreating(false);
  }

  async function revokeKey(id: string) {
    await fetch(`/api/v2/auth/keys/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <section>
      <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>API Keys</h2>

      {revealedKey && (
        <div
          style={{
            padding: 12,
            background: "#f0fff0",
            border: "1px solid #afa",
            borderRadius: 6,
            marginBottom: 16,
            fontSize: "0.85rem",
            wordBreak: "break-all",
          }}
        >
          <strong>New key (copy now — won't be shown again):</strong>
          <br />
          <code>{revealedKey}</code>
          <br />
          <button onClick={() => setRevealedKey(null)} style={{ marginTop: 8, fontSize: "0.8rem" }}>
            Dismiss
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          placeholder="Key name (optional)"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          style={{
            padding: "8px 10px",
            border: "1px solid #ddd",
            borderRadius: 6,
            flex: 1,
            fontSize: "0.85rem",
          }}
        />
        <button
          onClick={createKey}
          disabled={creating}
          style={{
            padding: "8px 16px",
            background: "#111",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          {creating ? "Creating…" : "Create key"}
        </button>
      </div>

      {keys.length === 0 ? (
        <p style={{ color: "#999", fontSize: "0.85rem" }}>No API keys yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>
              <th style={th}>Prefix</th>
              <th style={th}>Name</th>
              <th style={th}>Last used</th>
              <th style={th}>Created</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                <td style={td}>
                  <code>{k.prefix}…</code>
                </td>
                <td style={td}>{k.name ?? "—"}</td>
                <td style={td}>
                  {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "never"}
                </td>
                <td style={td}>{new Date(k.createdAt).toLocaleDateString()}</td>
                <td style={td}>
                  <button
                    onClick={() => revokeKey(k.id)}
                    style={{
                      color: "red",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                    }}
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

const th: React.CSSProperties = { padding: "6px 8px", fontWeight: 500, color: "#666" };
const td: React.CSSProperties = { padding: "8px" };
