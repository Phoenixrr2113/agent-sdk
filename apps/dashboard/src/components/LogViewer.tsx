'use client';

import { useState, useEffect, useRef } from 'react';

interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'trace';
  namespace: string;
  message: string;
  data?: Record<string, unknown>;
}

interface LogViewerProps {
  serverUrl?: string;
}

const levelColors: Record<string, string> = {
  debug: 'text-zinc-400',
  info: 'text-blue-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

export function LogViewer({ serverUrl = 'http://localhost:3000' }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [connected, setConnected] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connect = () => {
      eventSource = new EventSource(`${serverUrl}/logs`);

      eventSource.onopen = () => {
        setConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const logEntry = JSON.parse(event.data) as LogEntry;
          setLogs((prev) => [...prev.slice(-500), logEntry]); // Keep last 500 logs
        } catch {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        setConnected(false);
        eventSource?.close();
        // Reconnect after 3 seconds
        setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      eventSource?.close();
    };
  }, [serverUrl]);

  const filteredLogs = logs.filter((log) => {
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    if (filter && !log.message.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  const clearLogs = () => setLogs([]);

  return (
    <div className="flex h-full flex-col rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Logs</h2>
          <span
            className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter..."
            className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="all">All Levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
          <button
            onClick={clearLogs}
            className="rounded border border-zinc-300 px-2 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-zinc-950 p-2 font-mono text-xs">
        {filteredLogs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-zinc-500">
            {connected ? 'Waiting for logs...' : 'Connecting...'}
          </div>
        ) : (
          filteredLogs.map((log, i) => (
            <div key={i} className="flex gap-2 py-0.5 hover:bg-zinc-900">
              <span className="text-zinc-500">{log.timestamp}</span>
              <span className={`w-12 ${levelColors[log.level] || 'text-zinc-400'}`}>
                {log.level.toUpperCase()}
              </span>
              <span className="text-purple-400">[{log.namespace}]</span>
              <span className="text-zinc-100">{log.message}</span>
              {log.data && Object.keys(log.data).length > 0 && (
                <span className="text-zinc-500">
                  {Object.entries(log.data).map(([k, v]) =>
                    `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`
                  ).join(' ')}
                </span>
              )}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2 text-xs dark:border-zinc-800">
        <span className="text-zinc-500">{filteredLogs.length} entries</span>
        <label className="flex items-center gap-1 text-zinc-500">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          Auto-scroll
        </label>
      </div>
    </div>
  );
}
