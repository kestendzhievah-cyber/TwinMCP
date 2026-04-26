"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface Props {
  userId: string;
  teamspace: { id: string; name: string; plan: string } | null;
  members: { userId: string; email: string; role: string; joinedAt: string }[];
}

export function TeamPanel({ userId, teamspace, members }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function createTeam(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    await fetch("/api/v2/team", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCreating(false);
    setName("");
    router.refresh();
  }

  if (!teamspace) {
    return (
      <div style={{ marginTop: 16 }}>
        <p style={{ color: "#666", fontSize: "0.875rem", marginBottom: 16 }}>
          You don't belong to a teamspace yet. Create one to manage members and policies.
        </p>
        <form onSubmit={createTeam} style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="Teamspace name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{
              padding: "8px 10px",
              border: "1px solid #ddd",
              borderRadius: 6,
              flex: 1,
              fontSize: "0.85rem",
            }}
          />
          <button
            type="submit"
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
            {creating ? "Creating…" : "Create teamspace"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ color: "#666", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
        <strong>{teamspace.name}</strong> &middot; Plan: {teamspace.plan}
      </p>

      <h2 style={{ fontSize: "1rem", marginBottom: 12 }}>Members</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>
            <th style={th}>Email</th>
            <th style={th}>Role</th>
            <th style={th}>Joined</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.userId} style={{ borderBottom: "1px solid #f5f5f5" }}>
              <td style={td}>
                {m.email} {m.userId === userId && <em>(you)</em>}
              </td>
              <td style={td}>{m.role}</td>
              <td style={td}>{new Date(m.joinedAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { padding: "6px 8px", fontWeight: 500, color: "#666" };
const td: React.CSSProperties = { padding: "8px" };
