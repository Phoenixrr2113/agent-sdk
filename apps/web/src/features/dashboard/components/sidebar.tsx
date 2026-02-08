"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Monitor,
  ChevronLeft,
  ChevronRight,
  Settings,
  HelpCircle,
  Zap,
  MessageSquare,
  Target,
  Activity,
  LayoutDashboard,
  RotateCw,
  KeyRound,
  Menu,
  X,
} from "lucide-react"
import { cn } from "@/libs/utils"
import { NotificationsDropdown } from "./notifications-dropdown"
import { useDevices } from "@/hooks/use-devices"

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  activeMissionCount?: number
  activeAutomationCount?: number
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { id: "chat", label: "Chat", icon: MessageSquare, href: "/dashboard/chat" },
  { id: "missions", label: "Missions", icon: Target, href: "/dashboard/missions" },
  { id: "automations", label: "Automations", icon: RotateCw, href: "/dashboard/automations" },
  { id: "devices", label: "Devices", icon: Monitor, href: "/dashboard/devices" },
  { id: "vault", label: "Vault", icon: KeyRound, href: "/dashboard/vault" },
  { id: "activity", label: "Activity", icon: Activity, href: "/dashboard/activity" },
]

export function Sidebar({
  collapsed,
  onToggleCollapse,
  activeMissionCount = 2,
  activeAutomationCount = 4,
}: SidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showHelpTooltip, setShowHelpTooltip] = useState(false)
  const { devices } = useDevices({ autoRefresh: true, refreshInterval: 10000 })

  const hasConnectedDesktop = devices.some(
    (d) => d.platform === "desktop" && d.connection?.status === "connected"
  )

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false)
      }
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const handleMobileClose = () => {
    setMobileOpen(false)
  }

  return (
    <>
      {!mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open sidebar menu"
          className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-foreground shadow-lg hover:bg-secondary md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full flex-col border-r border-border bg-sidebar shadow-2xl transition-all duration-300",
          "md:relative md:shadow-none",
          collapsed ? "md:w-16" : "md:w-56",
          mobileOpen ? "w-72 translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-between border-b border-border px-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="h-4 w-4" />
            </div>
            {(!collapsed || mobileOpen) && (
              <span className={cn("text-sm font-semibold tracking-wide text-foreground", collapsed && "md:hidden")}>
                CONTROLAI
              </span>
            )}
          </div>
          {mobileOpen ? (
            <button
              onClick={() => setMobileOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={onToggleCollapse}
              className="hidden rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground md:block"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname.startsWith(item.href)
            const badge =
              item.id === "missions" ? activeMissionCount : item.id === "automations" ? activeAutomationCount : null
            const showDesktopIndicator = item.id === "devices" && hasConnectedDesktop

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={handleMobileClose}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <div className="relative">
                  <Icon className="h-4 w-4 shrink-0" />
                  {showDesktopIndicator && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-sidebar" />
                  )}
                </div>
                {(!collapsed || mobileOpen) && (
                  <span className={cn("flex-1 text-left", collapsed && "md:hidden")}>{item.label}</span>
                )}
                {(!collapsed || mobileOpen) && badge ? (
                  <span
                    className={cn(
                      "flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground",
                      collapsed && "md:hidden",
                    )}
                  >
                    {badge}
                  </span>
                ) : (!collapsed || mobileOpen) && isActive ? (
                  <div className={cn("h-1.5 w-1.5 rounded-full bg-primary", collapsed && "md:hidden")} />
                ) : null}
              </Link>
            )
          })}
        </nav>

        {/* Notifications - Now using dropdown component */}
        <div className="border-t border-border p-2">
          <NotificationsDropdown onViewActivity={handleMobileClose} />
        </div>

        {/* Bottom Actions */}
        <div className="space-y-1 border-t border-border p-2">
          <Link
            href="/dashboard/settings"
            onClick={handleMobileClose}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              pathname === "/dashboard/settings"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {(!collapsed || mobileOpen) && <span className={cn(collapsed && "md:hidden")}>Settings</span>}
          </Link>
          <div className="relative">
            <button
              onClick={() => setShowHelpTooltip(!showHelpTooltip)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <HelpCircle className="h-4 w-4 shrink-0" />
              {(!collapsed || mobileOpen) && <span className={cn(collapsed && "md:hidden")}>Help</span>}
            </button>
            {showHelpTooltip && (
              <div className="absolute bottom-full left-0 mb-2 w-48 rounded-lg border border-border bg-card p-3 shadow-lg">
                <p className="mb-2 text-xs text-muted-foreground">Need assistance?</p>
                <a href="mailto:support@controlai.dev" className="mb-1 block text-xs text-primary hover:underline">
                  support@controlai.dev
                </a>
                <a href="#" className="block text-xs text-primary hover:underline">
                  View Documentation
                </a>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
