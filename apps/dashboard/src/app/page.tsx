import { ChatPanel, LogViewer, ConfigEditor, StatusPanel } from '@/components';

export default function Dashboard() {
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000';

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤖</span>
            <h1 className="text-xl font-bold">Agent Dashboard</h1>
          </div>
          <StatusPanel serverUrl={serverUrl} />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 gap-4 p-4">
        {/* Left: Chat Panel */}
        <div className="flex w-1/2 flex-col">
          <ChatPanel serverUrl={serverUrl} />
        </div>

        {/* Right: Logs + Config */}
        <div className="flex w-1/2 flex-col gap-4">
          <div className="h-1/2">
            <LogViewer serverUrl={serverUrl} />
          </div>
          <div className="h-1/2">
            <ConfigEditor serverUrl={serverUrl} />
          </div>
        </div>
      </main>
    </div>
  );
}
