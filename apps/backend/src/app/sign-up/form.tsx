"use client";

import { createClient } from "@/utils/supabase/client";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

export function SignUpForm() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
      },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
  }

  if (done) {
    return (
      <main
        style={{
          maxWidth: 400,
          margin: "80px auto",
          fontFamily: "system-ui, sans-serif",
          padding: "0 1rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Check your email</h1>
        <p style={{ color: "#666" }}>We sent a confirmation link to {email}.</p>
      </main>
    );
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
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Create a TwinMCP account</h1>
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
          placeholder="Password (min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={inputStyle}
        />
        {error && <p style={{ color: "red", fontSize: "0.875rem" }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{ ...btnStyle, background: "#111", color: "#fff" }}
        >
          {loading ? "Creating…" : "Sign up"}
        </button>
      </form>
      <p style={{ marginTop: 16, fontSize: "0.875rem", color: "#666" }}>
        Already have an account?{" "}
        <a href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`} style={{ color: "#111" }}>
          Sign in
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
