"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Sidebar } from "./sidebar"
import { TopBar } from "./top-bar"
import { DevicesPanel } from "./devices-panel"
import { AgentChat } from "./agent-chat"
import { MissionsPanel } from "./missions-panel"
import { ActivityPanel } from "./activity-panel"
import { DashboardPanel } from "./dashboard-panel"
import { SettingsPanel } from "./settings-panel"
import { AutomationsPanel } from "./automations-panel"
import { VaultPanel } from "./vault-panel"
import { useMissions } from "@/hooks/use-missions"
import { useAutomations } from "@/hooks/use-automations"

export type ActiveView =
  | "dashboard"
  | "chat"
  | "missions"
  | "automations"
  | "devices"
  | "vault"
  | "activity"
  | "settings"

export function CommandCenter() {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Fetch real data for missions
  const { missions } = useMissions()

  // Fetch real data for automations
  const { automations } = useAutomations()

  // Calculate active mission count (executing, planning, or awaiting_approval)
  const activeMissionCount = missions.filter(
    (m) => m.status === 'executing' || m.status === 'planning' || m.status === 'awaiting_approval'
  ).length

  // Calculate active automation count
  const activeAutomationCount = automations.filter(
    (a) => a.status === 'active'
  ).length

  // Determine active view from pathname
  const getActiveView = (): ActiveView => {
    if (pathname.includes('/chat')) return 'chat'
    if (pathname.includes('/missions')) return 'missions'
    if (pathname.includes('/automations')) return 'automations'
    if (pathname.includes('/devices')) return 'devices'
    if (pathname.includes('/vault')) return 'vault'
    if (pathname.includes('/activity')) return 'activity'
    if (pathname.includes('/settings')) return 'settings'
    return 'dashboard'
  }

  const activeView = getActiveView()

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
          {activeView === "dashboard" && <DashboardPanel onNavigate={(page) => router.push(`/dashboard/${page}`)} />}
          {activeView === "chat" && <AgentChat />}
          {activeView === "missions" && <MissionsPanel onSelectMission={(id) => router.push(`/dashboard/missions/${id}`)} />}
          {activeView === "automations" && <AutomationsPanel onSelectAutomation={(id) => router.push(`/dashboard/automations/${id}`)} />}
          {activeView === "devices" && <DevicesPanel />}
          {activeView === "vault" && <VaultPanel />}
          {activeView === "activity" && <ActivityPanel initialFilter="all" onFilterChange={() => {}} />}
          {activeView === "settings" && <SettingsPanel />}
        </main>
      </div>
    </div>
  )
}
