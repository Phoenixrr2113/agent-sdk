"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/features/dashboard/components/sidebar"
import { TopBar } from "@/features/dashboard/components/top-bar"
import { CommandPalette } from "@/features/dashboard/components/command-palette"
import { KeyboardShortcutsModal } from "@/features/dashboard/components/keyboard-shortcuts-modal"
import { useMissions } from "@/hooks/use-missions"
import { useAutomations } from "@/hooks/use-automations"
import { useNavigationShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { useStatusNotifications } from "@/hooks/use-status-notifications"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false)

  // Fetch real data for missions and automations
  const { missions } = useMissions()
  const { automations } = useAutomations()

  // Enable status notifications for missions and approvals
  useStatusNotifications()

  // Calculate active mission count (executing, planning, or awaiting_approval)
  const activeMissionCount = missions.filter(
    (m) => m.status === 'executing' || m.status === 'planning' || m.status === 'awaiting_approval'
  ).length

  // Calculate active automation count
  const activeAutomationCount = automations.filter(
    (a) => a.status === 'active'
  ).length

  // Setup keyboard shortcuts
  useNavigationShortcuts(() => setCommandPaletteOpen(true))

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true)
      } else {
        setSidebarCollapsed(false)
      }
    }

    handleResize()

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeMissionCount={activeMissionCount}
        activeAutomationCount={activeAutomationCount}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="hidden md:block">
          <TopBar />
        </div>

        <main className="flex-1 overflow-hidden p-3 md:p-4">
          {children}
        </main>
      </div>

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />

      <KeyboardShortcutsModal
        open={keyboardShortcutsOpen}
        onOpenChange={setKeyboardShortcutsOpen}
      />
    </div>
  )
}

