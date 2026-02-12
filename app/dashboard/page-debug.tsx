'use client';

import React, { useState } from 'react';

export default function DebugPage() {
  const [test, setTest] = useState('test');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-4">Debug Page</h1>
        <p className="text-white">This is a debug page to test if React works.</p>
        <p className="text-white">Test state: {test}</p>
        <button 
          onClick={() => setTest('updated')}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg mt-4"
        >
          Update State
        </button>
      </div>
    </div>
  );
}
