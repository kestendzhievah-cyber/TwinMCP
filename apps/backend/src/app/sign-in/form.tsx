"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    router.push(returnTo as Parameters<typeof router.push>[0]);
  }

  async function handleOAuth(provider: "github" | "google") {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
      },
    });
  }

  return (
    <main
      style={{
        maxWidth: 400,
        margin: "80px auto",
        fontFamily: "system-ui, sans-serif",
        padding: "0 1rem",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Sign in to TwinMCP</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        <button onClick={() => handleOAuth("github")} style={btnStyle}>
          Continue with GitHub
        </button>
        <button onClick={() => handleOAuth("google")} style={btnStyle}>
          Continue with Google
        </button>
      </div>

      <hr style={{ marginBottom: 24, border: "none", borderTop: "1px solid #ddd" }} />

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />
        {error && <p style={{ color: "red", fontSize: "0.875rem" }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{ ...btnStyle, background: "#111", color: "#fff" }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p style={{ marginTop: 16, fontSize: "0.875rem", color: "#666" }}>
        No account?{" "}
        <a href={`/sign-up?returnTo=${encodeURIComponent(returnTo)}`} style={{ color: "#111" }}>
          Sign up
        </a>
      </p>
    </main>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 16px",
  border: "1px solid #ddd",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: "0.875rem",
  background: "#fff",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid #ddd",
  borderRadius: 6,
  fontSize: "0.875rem",
};
