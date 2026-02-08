"use client"

import { useState } from "react"
import {
  ArrowLeft,
  Activity,
  CheckCircle2,
  AlertCircle,
  Pause,
  XCircle,
  User,
  FileText,
  TrendingUp,
  Calendar,
  Send,
  Loader2,
} from "lucide-react"
import { cn } from "@/libs/utils"
import { useMission } from "@/hooks/use-mission"
import type { MissionStep } from "@/types/motia"

interface MissionDetailProps {
  missionId: string
  onBack: () => void
}

interface TimelineEvent {
  id: string
  type: "update" | "action" | "milestone" | "approval_needed" | "user_message"
  content: string
  timestamp: Date
  day: number
  status?: "completed" | "pending"
  icon?: typeof FileText
}

// Helper function to build timeline from mission steps
function buildTimelineFromSteps(steps: MissionStep[], startDate: string): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const startTime = new Date(startDate).getTime()
  const now = Date.now()
  
  steps.forEach((step) => {
    const stepTime = step.startedAt ? new Date(step.startedAt).getTime() : now
    const daysSinceStart = Math.floor((stepTime - startTime) / (1000 * 60 * 60 * 24))
    
    let type: TimelineEvent['type'] = 'action'
    let icon = Activity
    let status: TimelineEvent['status'] | undefined
    
    if (step.requiresApproval) {
      type = 'approval_needed'
      icon = AlertCircle
      status = step.status === 'completed' ? 'completed' : 'pending'
    } else if (step.status === 'completed' && step.result) {
      type = 'milestone'
      icon = CheckCircle2
    } else if (step.status === 'completed') {
      type = 'action'
      icon = CheckCircle2
      status = 'completed'
    }
    
    events.push({
      id: step.id,
      type,
      content: step.result || step.description,
      timestamp: new Date(stepTime),
      day: daysSinceStart,
      status,
      icon,
    })
  })
  
  return events
}

export function MissionDetail({ missionId, onBack }: MissionDetailProps) {
  const [replyInput, setReplyInput] = useState("")
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)
  
  const { mission, isLoading, error, refetch, updateMission, cancelMission, isUpdating, isCancelling } = useMission(missionId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !mission) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-muted-foreground">Failed to load mission</p>
        <button 
          onClick={() => refetch()}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
        >
          Try Again
        </button>
      </div>
    )
  }

  const daysSinceStart = Math.floor((Date.now() - new Date(mission.createdAt).getTime()) / (1000 * 60 * 60 * 24))
  
  // Build timeline from mission plan steps
  const timeline = mission.plan?.steps 
    ? buildTimelineFromSteps(mission.plan.steps, mission.createdAt)
    : []

  const handlePause = async () => {
    try {
      await updateMission({ status: 'paused' })
    } catch (err) {
      console.error('Failed to pause mission:', err)
    }
  }

  const handleCancel = async () => {
    try {
      await cancelMission()
      setShowCancelDialog(false)
    } catch (err) {
      console.error('Failed to cancel mission:', err)
    }
  }

  const handleReply = async () => {
    if (!replyInput.trim()) return
    
    setIsSubmittingReply(true)
    try {
      // TODO: Implement proper message endpoint when available
      // For now, we'll update the mission metadata with the message
      await updateMission({ 
        metadata: { 
          ...mission.metadata,
          lastUserMessage: replyInput,
          lastUserMessageAt: new Date().toISOString()
        } 
      })
      setReplyInput("")
    } catch (err) {
      console.error('Failed to send reply:', err)
    } finally {
      setIsSubmittingReply(false)
    }
  }

  const groupedTimeline = timeline.reduce(
    (acc, event) => {
      if (!acc[event.day]) acc[event.day] = []
      acc[event.day]!.push(event)
      return acc
    },
    {} as Record<number, TimelineEvent[]>,
  )
  
  const getStatusLabel = () => {
    switch (mission.status) {
      case 'awaiting_approval':
        return 'Needs Input'
      case 'executing':
        return 'In Progress'
      case 'planning':
        return 'Planning'
      case 'paused':
        return 'Paused'
      case 'completed':
        return 'Completed'
      case 'failed':
        return 'Failed'
      default:
        return mission.status
    }
  }
  
  const actionsCompleted = mission.plan?.steps.filter(s => s.status === 'completed').length || 0

  return (
    <div className="flex h-full min-h-0 flex-1 gap-4 overflow-hidden">
      {/* Main Timeline */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h2 className="font-medium text-foreground">{mission.goal}</h2>
              <p className="text-xs text-muted-foreground">Day {daysSinceStart}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePause}
              disabled={isUpdating || mission.status === 'paused' || mission.status === 'completed'}
              className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
              Pause
            </button>
            <button 
              onClick={() => setShowCancelDialog(true)}
              disabled={isCancelling || mission.status === 'completed'}
              className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              Cancel
            </button>
          </div>
        </div>
        
        {/* Cancel Confirmation Dialog */}
        {showCancelDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card border border-border rounded-xl p-6 max-w-md mx-4">
              <h3 className="text-lg font-semibold text-foreground mb-2">Cancel Mission?</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to cancel this mission? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowCancelDialog(false)}
                  disabled={isCancelling}
                  className="px-4 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-secondary disabled:opacity-50"
                >
                  Keep Mission
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isCancelling}
                  className="px-4 py-2 text-sm font-medium text-primary-foreground bg-destructive rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                      Cancelling...
                    </>
                  ) : (
                    'Yes, Cancel Mission'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto max-w-2xl">
            {Object.entries(groupedTimeline).map(([day, events]) => (
              <div key={day} className="mb-6">
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    Day {day}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="space-y-3">
                  {events.map((event) => {
                    const Icon = event.icon || Activity
                    const isUserMessage = event.type === "user_message"
                    const isMilestone = event.type === "milestone"
                    const isPending = event.status === "pending"

                    return (
                      <div
                        key={event.id}
                        className={cn("flex gap-2.5", isUserMessage ? "flex-row-reverse" : "flex-row")}
                      >
                        <div
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                            isUserMessage
                              ? "bg-secondary"
                              : isMilestone
                                ? "bg-primary/20"
                                : isPending
                                  ? "bg-warning/20"
                                  : "bg-secondary",
                          )}
                        >
                          {isUserMessage ? (
                            <User className="h-3.5 w-3.5 text-foreground" />
                          ) : (
                            <Icon
                              className={cn(
                                "h-3.5 w-3.5",
                                isMilestone ? "text-primary" : isPending ? "text-warning" : "text-muted-foreground",
                              )}
                            />
                          )}
                        </div>

                        <div className={cn("max-w-[85%]", isUserMessage && "text-right")}>
                          <div
                            className={cn(
                              "inline-block rounded-xl px-3 py-2",
                              isUserMessage
                                ? "bg-primary text-primary-foreground"
                                : isMilestone
                                  ? "border border-primary/30 bg-primary/5"
                                  : isPending
                                    ? "border border-warning/30 bg-warning/5"
                                    : "bg-secondary/50",
                            )}
                          >
                            {isMilestone && (
                              <div className="mb-1 flex items-center gap-1 text-xs font-medium text-primary">
                                <CheckCircle2 className="h-3 w-3" />
                                Milestone
                              </div>
                            )}
                            {isPending && (
                              <div className="mb-1 flex items-center gap-1 text-xs font-medium text-warning">
                                <AlertCircle className="h-3 w-3" />
                                Awaiting Input
                              </div>
                            )}
                            <p className="whitespace-pre-wrap text-sm">{event.content}</p>
                          </div>

                          {isPending && (
                            <div className="mt-2 flex gap-2">
                              <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
                                Yes, proceed
                              </button>
                              <button className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/80">
                                I'll handle it
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reply Input */}
        <div className="shrink-0 border-t border-border p-3">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-secondary/30 p-2">
              <textarea
                value={replyInput}
                onChange={(e) => setReplyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleReply()
                  }
                }}
                placeholder="Reply to this mission..."
                disabled={isSubmittingReply}
                className="max-h-24 min-h-[36px] flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
                rows={1}
              />
              <button
                onClick={handleReply}
                disabled={!replyInput.trim() || isSubmittingReply}
                className="shrink-0 rounded-lg bg-primary p-1.5 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isSubmittingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mission Info Sidebar */}
      <aside className="hidden w-64 shrink-0 space-y-3 overflow-y-auto md:block min-h-0">
        {/* Status */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium text-foreground">Status</h3>

          <div className="mb-3">
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              mission.status === 'awaiting_approval' && "bg-warning/10 text-warning",
              mission.status === 'executing' && "bg-primary/10 text-primary",
              mission.status === 'planning' && "bg-info/10 text-info",
              mission.status === 'paused' && "bg-muted/50 text-muted-foreground",
              mission.status === 'completed' && "bg-primary/10 text-primary",
              mission.status === 'failed' && "bg-destructive/10 text-destructive"
            )}>
              {mission.status === 'awaiting_approval' && <AlertCircle className="h-3 w-3" />}
              {mission.status === 'executing' && <Activity className="h-3 w-3" />}
              {mission.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
              {mission.status === 'failed' && <XCircle className="h-3 w-3" />}
              {getStatusLabel()}
            </span>
          </div>

          <div className="mb-3">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="text-foreground">{mission.progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${mission.progress}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-secondary/30 p-2">
              <p className="text-lg font-semibold text-foreground">{daysSinceStart}</p>
              <p className="text-xs text-muted-foreground">Days</p>
            </div>
            <div className="rounded-lg bg-secondary/30 p-2">
              <p className="text-lg font-semibold text-foreground">{actionsCompleted}</p>
              <p className="text-xs text-muted-foreground">Actions</p>
            </div>
          </div>
        </div>

        {/* Devices - Placeholder until we have device info in mission */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium text-foreground">Devices Used</h3>
          <div className="space-y-1.5">
            {mission.metadata?.devices && Array.isArray(mission.metadata.devices) && mission.metadata.devices.length > 0 ? (
              (mission.metadata.devices as string[]).map((device: string, i: number) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-secondary/30 px-3 py-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="text-sm text-foreground">{device}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No devices assigned</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium text-foreground">Quick Actions</h3>
          <div className="space-y-1.5">
            <button className="flex w-full items-center gap-2 rounded-lg bg-secondary/30 px-3 py-2 text-sm text-foreground hover:bg-secondary">
              <FileText className="h-4 w-4 text-muted-foreground" />
              View documents
            </button>
            <button className="flex w-full items-center gap-2 rounded-lg bg-secondary/30 px-3 py-2 text-sm text-foreground hover:bg-secondary">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              View analysis
            </button>
            <button className="flex w-full items-center gap-2 rounded-lg bg-secondary/30 px-3 py-2 text-sm text-foreground hover:bg-secondary">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Scheduled events
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
