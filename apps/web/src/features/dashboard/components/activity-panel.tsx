"use client"

import { useState, useEffect } from "react"
import {
  MousePointer,
  Mail,
  FileText,
  Globe,
  CheckCircle,
  Clock,
  Calendar,
  Monitor,
  ChevronRight,
  Activity,
} from "lucide-react"
import { cn } from "@/libs/utils"
import { useActivity, type ActivityType } from "@/hooks/use-activity"
import { useApprovals } from "@/hooks/use-approvals"

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmVariant = "primary",
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  confirmVariant?: "primary" | "destructive"
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              "flex-1 rounded-lg px-4 py-2 text-sm font-medium",
              confirmVariant === "destructive"
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

type ActivityFilter = "all" | "actions" | "approvals"

interface ActivityPanelProps {
  initialFilter?: ActivityFilter
  onFilterChange?: () => void
}

export function ActivityPanel({ initialFilter = "all", onFilterChange }: ActivityPanelProps) {
  const [filter, setFilter] = useState<ActivityFilter>(initialFilter)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    type: "approve" | "reject"
    itemId: string
  }>({ open: false, type: "approve", itemId: "" })

  // Map filter to activity type
  const activityType: ActivityType | undefined = 
    filter === "actions" ? "action" : 
    filter === "approvals" ? "approval" : 
    undefined

  const { activities, isLoading: activitiesLoading } = useActivity({ type: activityType })
  const { approvals, approveAction, rejectAction, isResponding } = useApprovals()

  const pendingCount = approvals.length

  useEffect(() => {
    setFilter(initialFilter)
  }, [initialFilter])

  const handleFilterChange = (newFilter: ActivityFilter) => {
    setFilter(newFilter)
    onFilterChange?.()
  }

  const handleApprove = (itemId: string) => {
    setConfirmDialog({ open: true, type: "approve", itemId })
  }

  const handleReject = (itemId: string) => {
    setConfirmDialog({ open: true, type: "reject", itemId })
  }

  const handleConfirm = async () => {
    try {
      if (confirmDialog.type === "approve") {
        await approveAction(confirmDialog.itemId)
      } else {
        await rejectAction(confirmDialog.itemId)
      }
      setConfirmDialog({ open: false, type: "approve", itemId: "" })
    } catch (error) {
      console.error('Failed to respond to approval:', error)
    }
  }

  // Helper function to get icon based on activity action
  const getActivityIcon = (action: string) => {
    if (action.includes('email') || action.includes('mail')) return Mail
    if (action.includes('click') || action.includes('tap')) return MousePointer
    if (action.includes('document') || action.includes('file')) return FileText
    if (action.includes('browse') || action.includes('search') || action.includes('web')) return Globe
    return FileText
  }

  // Helper function to format timestamp
  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Activity</h2>
          <p className="text-sm text-muted-foreground">
            {activitiesLoading
              ? "Loading..."
              : activities.length === 0
                ? "No activity yet"
                : pendingCount > 0
                  ? `${pendingCount} pending approval${pendingCount > 1 ? "s" : ""}`
                  : "All caught up"}
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
          <Calendar className="h-4 w-4" />
          Last 7 days
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 border-b border-border px-6 py-3">
        {(["all", "actions", "approvals"] as const).map((type) => (
          <button
            key={type}
            onClick={() => handleFilterChange(type)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              filter === type
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
            {type === "approvals" && pendingCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto p-4">
        {activitiesLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Activity className="h-8 w-8 text-muted-foreground animate-pulse" />
            </div>
            <p className="text-sm text-muted-foreground">Loading activity...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">No activity yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start a mission or automation to see activity here
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {activities.map((item) => {
              const Icon = getActivityIcon(item.action)
              const isPending = item.status === "pending"

              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex gap-3 rounded-lg border p-3 transition-colors",
                    isPending
                      ? "border-warning/30 bg-warning/5"
                      : "border-border bg-secondary/20 hover:bg-secondary/40",
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      isPending ? "bg-warning/10 text-warning" : "bg-secondary text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium text-foreground">{item.action}</h3>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      {isPending && item.type === 'approval' && (
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            onClick={() => handleApprove(item.id)}
                            disabled={isResponding}
                            className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(item.id)}
                            disabled={isResponding}
                            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {item.missionTitle && (
                        <button className="flex items-center gap-1 rounded-md bg-secondary/50 px-1.5 py-0.5 hover:bg-secondary">
                          {item.missionTitle}
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                      {item.deviceName && (
                        <span className="flex items-center gap-1">
                          <Monitor className="h-3 w-3" />
                          {item.deviceName}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        {item.status === "completed" ? (
                          <CheckCircle className="h-3 w-3 text-primary" />
                        ) : item.status === "failed" ? (
                          <Clock className="h-3 w-3 text-destructive" />
                        ) : (
                          <Clock className="h-3 w-3 text-warning" />
                        )}
                        {formatTimestamp(item.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.type === "approve" ? "Approve Action" : "Reject Action"}
        description={
          confirmDialog.type === "approve"
            ? "Are you sure you want to approve this action? The agent will proceed with the task."
            : "Are you sure you want to reject this action? The agent will not proceed."
        }
        confirmLabel={confirmDialog.type === "approve" ? "Approve" : "Reject"}
        confirmVariant={confirmDialog.type === "reject" ? "destructive" : "primary"}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmDialog({ open: false, type: "approve", itemId: "" })}
      />
    </div>
  )
}
