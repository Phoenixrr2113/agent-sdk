'use client';

import { useState, useEffect } from 'react';

interface AgentStatus {
  role: string;
  tools: string[];
  model?: string;
  version: string;
  uptime?: number;
}

interface StatusPanelProps {
  serverUrl?: string;
}

export function StatusPanel({ serverUrl = 'http://localhost:3000' }: StatusPanelProps) {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [serverUrl]);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${serverUrl}/status`);
      if (!response.ok) throw new Error('Failed to fetch status');
      const data = await response.json();
      setStatus(data);
      setConnected(true);
      setError(null);
    } catch (e) {
      setConnected(false);
      setError(e instanceof Error ? e.message : 'Connection failed');
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Agent Status</h2>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span className="text-sm text-zinc-500">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {error ? (
        <div className="mt-4 text-sm text-red-500">{error}</div>
      ) : status ? (
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500">Role</span>
            <span className="font-medium">{status.role}</span>
          </div>
          {status.model && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Model</span>
              <span className="font-mono text-xs">{status.model}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-zinc-500">Version</span>
            <span className="font-mono text-xs">{status.version}</span>
          </div>
          <div>
            <span className="text-zinc-500">Tools</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {status.tools.map((tool) => (
                <span
                  key={tool}
                  className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-zinc-400">Loading...</div>
      )}
    </div>
  );
}
