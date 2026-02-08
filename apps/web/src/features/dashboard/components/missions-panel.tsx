"use client"

import { useState } from "react"
import {
  Target,
  Clock,
  Activity,
  CheckCircle2,
  AlertCircle,
  Pause,
  MoreHorizontal,
  Search,
  Plus,
  Bot,
  Loader2,
} from "lucide-react"
import { cn } from "@/libs/utils"
import { useMissions, type MissionStatus } from "@/hooks/use-missions"
import { MissionContextModal } from "./mission-context-modal"

interface MissionsPanelProps {
  onSelectMission: (missionId: string) => void
}

type UIStatus = "active" | "paused" | "completed" | "needs_input"

const statusConfig = {
  active: { label: "Active", color: "text-primary", bg: "bg-primary/10", icon: Activity },
  paused: { label: "Paused", color: "text-warning", bg: "bg-warning/10", icon: Pause },
  completed: { label: "Completed", color: "text-muted-foreground", bg: "bg-secondary", icon: CheckCircle2 },
  needs_input: { label: "Needs Input", color: "text-primary", bg: "bg-primary/10", icon: AlertCircle },
}

function mapAPIStatusToUI(apiStatus: MissionStatus): UIStatus {
  switch (apiStatus) {
    case "executing":
    case "planning":
      return "active"
    case "awaiting_approval":
      return "needs_input"
    case "paused":
      return "paused"
    case "completed":
    case "failed":
      return "completed"
    default:
      return "active"
  }
}

export function MissionsPanel({ onSelectMission }: MissionsPanelProps) {
  const { missions: apiMissions, isLoading } = useMissions()
  const [filter, setFilter] = useState<"all" | UIStatus>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)

  const missions = apiMissions.map((m) => {
    const uiStatus = mapAPIStatusToUI(m.status)
    const completedSteps = m.plan?.steps.filter((s) => s.status === "completed").length || 0
    const totalSteps = m.plan?.steps.length || 0

    return {
      id: m.id,
      title: m.goal.length > 100 ? `${m.goal.substring(0, 100)}...` : m.goal,
      description: m.plan?.reasoning || "Mission in progress",
      status: uiStatus,
      progress: m.progress,
      startDate: new Date(m.createdAt),
      lastUpdate: m.error || m.plan?.steps[m.plan.steps.length - 1]?.description || "Starting...",
      actionsCompleted: completedSteps,
      totalActions: totalSteps,
      category: "Mission",
    }
  })

  const filteredMissions = missions.filter((m) => {
    if (filter !== "all" && m.status !== filter) return false
    if (searchQuery && !m.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const activeMissions = missions.filter((m) => m.status === "active" || m.status === "needs_input").length

  return (
    <>
      <MissionContextModal open={isModalOpen} onOpenChange={setIsModalOpen} />
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Missions</h2>
            <p className="text-sm text-muted-foreground">{activeMissions} active</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Mission</span>
          </button>
        </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 border-b border-border px-6 py-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search missions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-secondary/30 py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(["all", "active", "needs_input", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {f === "needs_input" ? "Needs Input" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Mission List */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading missions...</p>
          </div>
        ) : filteredMissions.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Bot className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground truncate">No missions found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery || filter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Start your first mission to see it here"}
              </p>
            </div>
            {!searchQuery && filter === "all" && (
              <button
                    onClick={() => setIsModalOpen(true)}
                className="mt-2 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                New Mission
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMissions.map((mission) => {
              const status = statusConfig[mission.status]
              const StatusIcon = status.icon
              const daysSinceStart = Math.floor((Date.now() - mission.startDate.getTime()) / (1000 * 60 * 60 * 24))

              return (
                <div
                  key={mission.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectMission(mission.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onSelectMission(mission.id)
                    }
                  }}
                  className="w-full cursor-pointer rounded-xl border border-border bg-secondary/20 p-4 text-left transition-all hover:border-primary/40 hover:bg-secondary/40"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", status.bg)}>
                        <Target className={cn("h-4 w-4", status.color)} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-foreground truncate">{mission.title}</h3>
                        <p className="text-sm text-muted-foreground truncate">{mission.description}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          status.bg,
                          status.color,
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                      <button
                        className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mb-3">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="text-foreground">{mission.progress}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          mission.status === "needs_input"
                            ? "bg-primary"
                            : mission.status === "completed"
                              ? "bg-muted-foreground"
                              : "bg-primary",
                        )}
                        style={{ width: `${mission.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Last update */}
                  <p className="mb-3 text-sm text-foreground line-clamp-1">{mission.lastUpdate}</p>

                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {daysSinceStart}d
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      {mission.actionsCompleted}/{mission.totalActions}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5">{mission.category}</span>
                  </div>
                </div>
              )
            })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
