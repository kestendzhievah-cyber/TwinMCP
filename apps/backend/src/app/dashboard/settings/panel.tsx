"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SettingsPanel() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await fetch("/api/v2/account", { method: "DELETE" });
    router.push("/");
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 16 }}>Settings</h1>

      <section
        style={{
          padding: 20,
          border: "1px solid #fcc",
          borderRadius: 8,
          maxWidth: 480,
        }}
      >
        <h2 style={{ fontSize: "1rem", color: "#c00", marginBottom: 8 }}>Delete account</h2>
        <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: 16 }}>
          This permanently deletes your account, API keys, usage history, and team memberships. This
          action cannot be undone.
        </p>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            style={{
              padding: "8px 16px",
              background: "#fff",
              color: "#c00",
              border: "1px solid #c00",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Delete my account
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                padding: "8px 16px",
                background: "#c00",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              {deleting ? "Deleting…" : "Yes, delete everything"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              style={{
                padding: "8px 16px",
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
