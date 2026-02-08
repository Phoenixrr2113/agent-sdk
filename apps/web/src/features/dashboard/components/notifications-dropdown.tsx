"use client"

import { useState, useRef, useEffect } from "react"
import { Bell, CheckCircle2, AlertCircle, Info, X, Target, RotateCw, Clock } from "lucide-react"
import { cn } from "@/libs/utils"
import { useNotifications } from "@/hooks/use-notifications"

type NotificationType = "approval" | "update" | "alert" | "info"

const typeConfig: Record<NotificationType, { icon: typeof Clock; color: string; bg: string }> = {
  approval: { icon: Clock, color: "text-warning", bg: "bg-warning/10" },
  update: { icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10" },
  alert: { icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" },
  info: { icon: Info, color: "text-info", bg: "bg-info/10" },
}

// Helper function to map notification priority to type for UI
function mapNotificationToType(priority: string): NotificationType {
  switch (priority) {
    case 'urgent':
    case 'high':
      return 'alert'
    case 'normal':
      return 'update'
    case 'low':
      return 'info'
    default:
      return 'info'
  }
}

// Helper function to format timestamp
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

interface NotificationsDropdownProps {
  onViewActivity: () => void
}

export function NotificationsDropdown({ onViewActivity }: NotificationsDropdownProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    markAsRead, 
    dismiss, 
    markAllAsRead,
    isDismissing,
    isMarkingAsRead 
  } = useNotifications()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id)
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const handleDismiss = async (id: string) => {
    try {
      await dismiss(id)
    } catch (error) {
      console.error('Failed to dismiss notification:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead()
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <div className="relative">
          <Bell className="h-4 w-4 shrink-0" />
          {unreadCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>
        <span className="md:hidden lg:inline">Notifications</span>
      </button>

      {open && (
        <div className="fixed inset-x-2 bottom-16 z-50 rounded-xl border border-border bg-card shadow-lg md:absolute md:inset-x-auto md:bottom-full md:left-0 md:mb-2 md:w-80">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllAsRead} 
                disabled={isMarkingAsRead}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto md:max-h-80">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <Bell className="h-8 w-8 animate-pulse text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <Bell className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const notificationType = mapNotificationToType(notification.priority)
                const config = typeConfig[notificationType]
                const Icon = config.icon
                const metadata = notification.metadata || {}
                const sourceType = (metadata.sourceType as "mission" | "automation") || "mission"
                const source = (metadata.source as string) || "System"
                const SourceIcon = sourceType === "mission" ? Target : RotateCw

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "group relative border-b border-border p-3 transition-colors last:border-0 cursor-pointer",
                      !notification.read && "bg-primary/5",
                    )}
                    onClick={() => {
                      if (!notification.read) {
                        handleMarkAsRead(notification.id)
                      }
                    }}
                  >
                    <div className="flex gap-3">
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", config.bg)}>
                        <Icon className={cn("h-4 w-4", config.color)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{notification.title}</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDismiss(notification.id)
                            }}
                            disabled={isDismissing}
                            className="shrink-0 rounded-md p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100 disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground md:gap-2">
                          <span className="flex items-center gap-1">
                            <SourceIcon className="h-3 w-3" />
                            <span className="truncate">{source}</span>
                          </span>
                          <span className="hidden md:inline">•</span>
                          <span>{formatTimestamp(notification.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    {!notification.read && (
                      <div className="absolute left-1.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary" />
                    )}
                  </div>
                )
              })
            )}
          </div>

          <div className="border-t border-border p-2">
            <button
              onClick={() => {
                onViewActivity()
                setOpen(false)
              }}
              className="w-full rounded-lg px-3 py-2 text-center text-sm text-primary hover:bg-primary/10"
            >
              View all activity
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
