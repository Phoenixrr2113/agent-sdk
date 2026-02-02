'use client';

import { useState, useEffect } from 'react';

interface ConfigEditorProps {
  serverUrl?: string;
}

export function ConfigEditor({ serverUrl = 'http://localhost:3000' }: ConfigEditorProps) {
  const [config, setConfig] = useState('');
  const [originalConfig, setOriginalConfig] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [serverUrl]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${serverUrl}/config`);
      if (!response.ok) throw new Error('Failed to fetch config');
      const data = await response.text();
      setConfig(data);
      setOriginalConfig(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      setError(null);
      const response = await fetch(`${serverUrl}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/yaml' },
        body: config,
      });
      if (!response.ok) throw new Error('Failed to save config');
      setOriginalConfig(config);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = () => {
    setConfig(originalConfig);
    setError(null);
  };

  const hasChanges = config !== originalConfig;

  return (
    <div className="flex h-full flex-col rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Configuration</h2>
        <div className="flex items-center gap-2">
          {error && <span className="text-sm text-red-500">{error}</span>}
          {success && <span className="text-sm text-green-500">Saved!</span>}
          <button
            onClick={resetConfig}
            disabled={!hasChanges || saving}
            className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Reset
          </button>
          <button
            onClick={saveConfig}
            disabled={!hasChanges || saving}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center text-zinc-400">
            Loading...
          </div>
        ) : (
          <textarea
            value={config}
            onChange={(e) => setConfig(e.target.value)}
            spellCheck={false}
            className="h-full w-full resize-none bg-zinc-950 p-4 font-mono text-sm text-zinc-100 focus:outline-none"
            placeholder="# YAML configuration"
          />
        )}
      </div>

      {hasChanges && (
        <div className="border-t border-zinc-200 px-4 py-2 text-xs text-yellow-500 dark:border-zinc-800">
          ⚠ Unsaved changes
        </div>
      )}
    </div>
  );
}
