"use client";

import React from "react";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full">
      {children}
    </div>
  );
}
