"use client";

// layout.tsx - Version simplifiée sans sidebar
import React from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-[#0a0a0f] text-gray-100">
      {/* ===== Main content ===== */}
      <main className="min-h-screen">
        {children}
      </main>
    </div>
  );
}
