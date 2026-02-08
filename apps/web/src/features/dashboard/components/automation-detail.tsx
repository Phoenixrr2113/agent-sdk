"use client"

import { useState } from "react"
import {
  ArrowLeft,
  Play,
  Pause,
  Settings,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCw,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react"
import { cn } from "@/libs/utils"
import { useAutomation } from "@/hooks/use-automation"

interface AutomationDetailProps {
  automationId: string
  onBack: () => void
}

interface RunLog {
  id: string
  timestamp: string
  status: "success" | "failed" | "running"
  duration: string | null
  summary: string
  steps: {
    name: string
    status: "success" | "failed" | "running" | "skipped"
    detail?: string
  }[]
}

const statusConfig = {
  success: { icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10" },
  failed: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
  running: { icon: RotateCw, color: "text-info", bg: "bg-info/10" },
  skipped: { icon: ChevronRight, color: "text-muted-foreground", bg: "bg-muted" },
}

export function AutomationDetail({ automationId, onBack }: AutomationDetailProps) {
  const [expandedRun, setExpandedRun] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const {
    automation,
    isLoading,
    error,
    pauseAutomation,
    resumeAutomation,
    runNow,
    deleteAutomation,
    isPausing,
    isResuming,
    isRunning,
    isDeleting,
  } = useAutomation(automationId)

  const handleDelete = async () => {
    try {
      await deleteAutomation()
      onBack()
    } catch (err) {
      console.error('Failed to delete automation:', err)
    }
  }

  const handlePause = async () => {
    try {
      await pauseAutomation()
    } catch (err) {
      console.error('Failed to pause automation:', err)
    }
  }

  const handleResume = async () => {
    try {
      await resumeAutomation()
    } catch (err) {
      console.error('Failed to resume automation:', err)
    }
  }

  const handleRunNow = async () => {
    try {
      await runNow()
    } catch (err) {
      console.error('Failed to run automation:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !automation) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <XCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load automation</p>
        <button
          onClick={onBack}
          className="mt-2 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80"
        >
          Go Back
        </button>
      </div>
    )
  }

  const isPaused = automation.status === 'paused'
  const isActive = automation.status === 'active'

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg max-w-md border border-border">
            <h3 className="text-lg font-semibold text-foreground">Delete Automation?</h3>
            <p className="text-muted-foreground mt-2">
              This action cannot be undone. All run history will be permanently deleted.
            </p>
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{automation.name}</h1>
            <span
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                isActive && "bg-primary/10 text-primary",
                isPaused && "bg-muted text-muted-foreground",
                automation.status === 'error' && "bg-destructive/10 text-destructive",
                automation.status === 'disabled' && "bg-muted text-muted-foreground"
              )}
            >
              {isActive && <Play className="h-3 w-3" />}
              {isPaused && <Pause className="h-3 w-3" />}
              {automation.status.charAt(0).toUpperCase() + automation.status.slice(1)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{automation.description || 'No description'}</p>
        </div>
        <div className="flex items-center gap-2">
          {isPaused ? (
            <button
              onClick={handleResume}
              disabled={isResuming}
              className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
            >
              {isResuming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Resume
            </button>
          ) : (
            <button
              onClick={handlePause}
              disabled={isPausing}
              className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
            >
              {isPausing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
              Pause
            </button>
          )}
          <button
            onClick={handleRunNow}
            disabled={isRunning}
            className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run Now
          </button>
          <button className="rounded-lg border border-border bg-secondary p-2 text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Main Content - Run History */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-medium text-foreground">Run History</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {!automation.metadata?.runs || (automation.metadata.runs as RunLog[]).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 py-12">
                <RotateCw className="h-12 w-12 text-muted-foreground/50" />
                <p className="text-muted-foreground">No runs yet</p>
                <p className="text-sm text-muted-foreground">
                  {isActive ? "This automation will run based on its trigger" : "Resume the automation to start running"}
                </p>
              </div>
            ) : (
              (automation.metadata.runs as RunLog[]).map((run) => {
                const StatusIcon = statusConfig[run.status].icon
                const isExpanded = expandedRun === run.id

                return (
                  <div key={run.id} className="border-b border-border last:border-b-0">
                    <button
                      onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                      className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/50"
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full",
                          statusConfig[run.status].bg,
                        )}
                      >
                        <StatusIcon
                          className={cn(
                            "h-4 w-4",
                            statusConfig[run.status].color,
                            run.status === "running" && "animate-spin",
                          )}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{run.timestamp}</span>
                          {run.duration && <span className="text-xs text-muted-foreground">({run.duration})</span>}
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">{run.summary}</p>
                      </div>
                      <ChevronDown
                        className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")}
                      />
                    </button>

                    {isExpanded && run.steps && (
                      <div className="border-t border-border bg-secondary/30 px-4 py-3">
                        <div className="space-y-2">
                          {run.steps.map((step, index) => {
                            const StepIcon = statusConfig[step.status].icon
                            return (
                              <div key={index} className="flex items-center gap-3">
                                <div className="flex h-6 w-6 items-center justify-center">
                                  <StepIcon
                                    className={cn(
                                      "h-4 w-4",
                                      statusConfig[step.status].color,
                                      step.status === "running" && "animate-spin",
                                    )}
                                  />
                                </div>
                                <span className="text-sm text-foreground">{step.name}</span>
                                {step.detail && <span className="text-xs text-muted-foreground">— {step.detail}</span>}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Sidebar - Configuration */}
        <div className="w-72 shrink-0 space-y-4 overflow-y-auto">
          {/* Stats */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-medium text-foreground">Statistics</h3>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Runs</span>
                <span className="text-sm font-medium text-foreground">{automation.runCount || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last Run</span>
                <span className="text-sm font-medium text-foreground">
                  {automation.lastRunAt
                    ? new Date(automation.lastRunAt).toLocaleDateString()
                    : 'Never'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    automation.lastRunStatus === 'completed' && "text-primary",
                    automation.lastRunStatus === 'failed' && "text-destructive",
                    !automation.lastRunStatus && "text-muted-foreground"
                  )}
                >
                  {automation.lastRunStatus
                    ? automation.lastRunStatus.charAt(0).toUpperCase() + automation.lastRunStatus.slice(1)
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Trigger */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-medium text-foreground">Trigger</h3>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">
                  {automation.trigger.type === 'cron' && (automation.trigger as { expression: string }).expression}
                  {automation.trigger.type === 'event' && `Event: ${(automation.trigger as { eventName: string }).eventName}`}
                  {automation.trigger.type === 'webhook' && `Webhook: ${(automation.trigger as { path: string }).path}`}
                  {automation.trigger.type === 'manual' && 'Manual trigger'}
                </span>
              </div>
              {automation.trigger.type === 'cron' && (
                <>
                  <div className="rounded-md bg-secondary px-2 py-1">
                    <code className="text-xs text-muted-foreground">
                      {(automation.trigger as { expression: string }).expression}
                    </code>
                  </div>
                  {(automation.trigger as { timezone?: string }).timezone && (
                    <p className="text-xs text-muted-foreground">
                      Timezone: {(automation.trigger as { timezone: string }).timezone}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-medium text-foreground">Actions</h3>
            <div className="mt-3 space-y-2">
              {automation.actions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No actions configured</p>
              ) : (
                automation.actions
                  .sort((a, b) => a.order - b.order)
                  .map((action) => (
                    <div key={action.id} className="flex items-start gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 shrink-0 mt-0.5">
                        <span className="text-xs font-medium text-primary">{action.order + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground break-words">{action.type}</p>
                        {action.config && Object.keys(action.config).length > 0 && (
                          <p className="text-xs text-muted-foreground truncate">
                            {Object.entries(action.config)
                              .slice(0, 2)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
            <h3 className="text-sm font-medium text-destructive">Danger Zone</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Permanently delete this automation and all run history.
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="mt-3 w-full rounded-lg border border-destructive bg-destructive/10 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
            >
              Delete Automation
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
