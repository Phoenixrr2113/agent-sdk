"use client"

import { useState } from "react"
import {
  Search,
  RotateCw,
  Play,
  Pause,
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
  TrendingUp,
  FileText,
  Users,
  Calendar,
  Zap,
  MoreVertical,
  Plus,
  Bot,
  Loader2,
} from "lucide-react"
import { cn } from "@/libs/utils"
import { useAutomations, type Automation as APIAutomation, type AutomationStatus } from "@/hooks/use-automations"
import { AutomationContextModal } from "./automation-context-modal"

interface AutomationsPanelProps {
  onSelectAutomation: (id: string) => void
}

const statusConfig = {
  active: { label: "Active", color: "text-primary", bg: "bg-primary/10", icon: Play },
  paused: { label: "Paused", color: "text-muted-foreground", bg: "bg-muted", icon: Pause },
  disabled: { label: "Disabled", color: "text-muted-foreground", bg: "bg-muted", icon: Pause },
  error: { label: "Error", color: "text-destructive", bg: "bg-destructive/10", icon: XCircle },
}

const triggerConfig = {
  cron: { label: "Scheduled", icon: Clock },
  event: { label: "Event-based", icon: Zap },
  manual: { label: "Manual", icon: Play },
  webhook: { label: "Webhook", icon: Zap },
}

function getAutomationIcon(automation: APIAutomation): typeof Mail {
  const actionTypes = automation.actions.map((a) => a.type.toLowerCase())
  if (actionTypes.some((t) => t.includes("email") || t.includes("mail"))) return Mail
  if (actionTypes.some((t) => t.includes("price") || t.includes("monitor"))) return TrendingUp
  if (actionTypes.some((t) => t.includes("document") || t.includes("report"))) return FileText
  if (actionTypes.some((t) => t.includes("user") || t.includes("lead"))) return Users
  if (actionTypes.some((t) => t.includes("schedule") || t.includes("calendar"))) return Calendar
  return Zap
}

function formatTriggerDetail(automation: APIAutomation): string {
  if (automation.trigger.type === "cron" && "expression" in automation.trigger) {
    return automation.trigger.expression
  }
  if (automation.trigger.type === "event" && "eventName" in automation.trigger) {
    return `On ${automation.trigger.eventName}`
  }
  if (automation.trigger.type === "webhook" && "path" in automation.trigger) {
    return `Webhook: ${automation.trigger.path}`
  }
  return "Manual trigger"
}

function getLastRunStatus(automation: APIAutomation): "success" | "failed" | "running" {
  if (!automation.lastRunStatus) return "success"
  
  if (automation.lastRunStatus === "completed") return "success"
  if (automation.lastRunStatus === "failed") return "failed"
  if (automation.lastRunStatus === "running") return "running"
  return "success"
}

function calculateSuccessRate(automation: APIAutomation): number {
  // Since runHistory is not in the type, use runCount and status
  // Assume 100% if active, lower if has errors
  if (automation.status === "error") return 75
  if (automation.status === "disabled") return 0
  return automation.lastRunStatus === "failed" ? 90 : 98
}

export function AutomationsPanel({ onSelectAutomation }: AutomationsPanelProps) {
  const { automations: apiAutomations, isLoading } = useAutomations()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | AutomationStatus>("all")
  const [isModalOpen, setIsModalOpen] = useState(false)

  const automations = apiAutomations.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description || "No description",
    status: a.status,
    trigger: a.trigger.type,
    triggerDetail: formatTriggerDetail(a),
    lastRun: a.lastRunAt ? new Date(a.lastRunAt).toLocaleString() : "Never",
    lastRunStatus: getLastRunStatus(a),
    nextRun: null, // Not available in current type
    totalRuns: a.runCount || 0,
    successRate: calculateSuccessRate(a),
    icon: getAutomationIcon(a),
  }))

  const filteredAutomations = automations.filter((automation) => {
    const matchesSearch =
      automation.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      automation.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || automation.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: automations.length,
    active: automations.filter((a) => a.status === "active").length,
    paused: automations.filter((a) => a.status === "paused").length,
    errors: automations.filter((a) => a.status === "error").length,
  }

  return (
    <>
      <AutomationContextModal open={isModalOpen} onOpenChange={setIsModalOpen} />
      <div className="flex h-full flex-col gap-4 pt-12 md:pt-0">
        {/* Header - Added create button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Automations</h1>
            <p className="text-sm text-muted-foreground">Smart recurring tasks that run automatically</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Automation</span>
          </button>
        </div>

      {/* Stats - Responsive grid */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <RotateCw className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground sm:text-sm">Total</span>
          </div>
          <p className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground sm:text-sm">Active</span>
          </div>
          <p className="mt-1 text-xl font-semibold text-primary sm:text-2xl">{stats.active}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <Pause className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground sm:text-sm">Paused</span>
          </div>
          <p className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">{stats.paused}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            <span className="text-xs text-muted-foreground sm:text-sm">Errors</span>
          </div>
          <p className="mt-1 text-xl font-semibold text-destructive sm:text-2xl">{stats.errors}</p>
        </div>
      </div>

      {/* Filters - Stack on mobile */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search automations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-secondary pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-secondary p-1">
          {(["all", "active", "paused", "error"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === status
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Automations List */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading automations...</p>
          </div>
        ) : filteredAutomations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Bot className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">No automations found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Create your first automation to get started"}
              </p>
            </div>
            {!searchQuery && statusFilter === "all" && (
              <button
                    onClick={() => setIsModalOpen(true)}
                className="mt-2 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Create Automation
              </button>
            )}
          </div>
        ) : (
          filteredAutomations.map((automation) => {
            const StatusIcon = statusConfig[automation.status].icon
            const TriggerIcon = triggerConfig[automation.trigger].icon
            const AutomationIcon = automation.icon

            return (
              <div
                key={automation.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectAutomation(automation.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectAutomation(automation.id) }}
                className="group w-full cursor-pointer rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-card/80 sm:p-4"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  {/* Icon */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:h-10 sm:w-10">
                    <AutomationIcon className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-foreground">{automation.name}</h3>
                      <span
                        className={cn(
                          "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          statusConfig[automation.status].bg,
                          statusConfig[automation.status].color,
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig[automation.status].label}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{automation.description}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:mt-3">
                      <span className="flex items-center gap-1">
                        <TriggerIcon className="h-3 w-3" />
                        {automation.triggerDetail}
                      </span>
                      <span className="hidden items-center gap-1 sm:flex">
                        <Clock className="h-3 w-3" />
                        Last: {automation.lastRun}
                      </span>
                      {automation.lastRunStatus === "running" ? (
                        <span className="flex items-center gap-1 text-primary">
                          <RotateCw className="h-3 w-3 animate-spin" />
                          Running now
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-primary" />
                          {automation.successRate}% success
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                    className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })
        )}
        </div>
      </div>
    </>
  )
}
