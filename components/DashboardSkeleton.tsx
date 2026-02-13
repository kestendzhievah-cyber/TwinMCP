'use client';

import React from 'react';

function Pulse({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-purple-500/10 rounded-lg ${className}`} />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <Pulse className="w-10 h-10 rounded-xl" />
        <Pulse className="w-16 h-8" />
      </div>
      <Pulse className="w-24 h-4" />
    </div>
  );
}

export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Pulse className="w-10 h-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Pulse className="w-32 h-5" />
          <Pulse className="w-48 h-3" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Pulse key={i} className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6 space-y-4">
      <Pulse className="w-40 h-6 mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3 border-b border-purple-500/10 last:border-0">
          <Pulse className="w-8 h-8 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Pulse className="w-32 h-4" />
            <Pulse className="w-48 h-3" />
          </div>
          <Pulse className="w-16 h-6 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="space-y-2">
        <Pulse className="w-64 h-8" />
        <Pulse className="w-96 h-4" />
      </div>
      <StatsGridSkeleton />
      <div className="grid lg:grid-cols-2 gap-6">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
      </div>
      <TableSkeleton rows={3} />
    </div>
  );
}
