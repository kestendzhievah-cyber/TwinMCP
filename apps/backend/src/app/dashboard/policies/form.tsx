"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function PoliciesForm({
  teamspaceId,
  minTrustScore,
  blockedLibraryIds,
}: {
  teamspaceId: string;
  minTrustScore: number;
  blockedLibraryIds: string[];
}) {
  const router = useRouter();
  const [trust, setTrust] = useState(minTrustScore);
  const [blocked, setBlocked] = useState(blockedLibraryIds.join(", "));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/v2/policies", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        teamspaceId,
        minTrustScore: trust,
        blockedLibraryIds: blocked
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });
    setSaving(false);
    setMsg(res.ok ? "Saved" : "Error saving");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 }}
    >
      <label style={{ fontSize: "0.85rem" }}>
        <strong>Minimum trust score</strong> (0–10)
        <br />
        <input
          type="number"
          min={0}
          max={10}
          step={0.5}
          value={trust}
          onChange={(e) => setTrust(Number(e.target.value))}
          style={{
            marginTop: 4,
            padding: "8px 10px",
            border: "1px solid #ddd",
            borderRadius: 6,
            width: 100,
          }}
        />
      </label>

      <label style={{ fontSize: "0.85rem" }}>
        <strong>Blocked library IDs</strong> (comma-separated)
        <br />
        <input
          value={blocked}
          onChange={(e) => setBlocked(e.target.value)}
          placeholder="/owner/repo, /other/lib"
          style={{
            marginTop: 4,
            padding: "8px 10px",
            border: "1px solid #ddd",
            borderRadius: 6,
            width: "100%",
          }}
        />
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "8px 20px",
            background: "#111",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          {saving ? "Saving…" : "Save policies"}
        </button>
        {msg && (
          <span style={{ fontSize: "0.8rem", color: msg === "Saved" ? "green" : "red" }}>
            {msg}
          </span>
        )}
      </div>
    </form>
  );
}
