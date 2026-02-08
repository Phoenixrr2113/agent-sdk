"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Target, Clock, Shield } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/libs/utils"

interface MissionContextModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const timeConstraints = [
  { value: "asap", label: "ASAP" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "no_rush", label: "No rush" },
] as const

export function MissionContextModal({ open, onOpenChange }: MissionContextModalProps) {
  const router = useRouter()
  const [goal, setGoal] = useState("")
  const [timeConstraint, setTimeConstraint] = useState<string | null>(null)
  const [requireApproval, setRequireApproval] = useState(true)

  const handleSubmit = () => {
    if (!goal.trim()) return

    const params = new URLSearchParams({
      type: "mission",
      goal: goal.trim(),
    })
    if (timeConstraint) {
      params.set("timeConstraint", timeConstraint)
    }
    if (requireApproval) {
      params.set("requireApproval", "true")
    }

    onOpenChange(false)
    router.push(`/dashboard/chat?${params.toString()}`)
  }

  const handleClose = () => {
    setGoal("")
    setTimeConstraint(null)
    setRequireApproval(true)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>New Mission</DialogTitle>
              <DialogDescription>
                Describe what you want to accomplish
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              What would you like to accomplish?
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g., Find rental properties in Austin under $300K"
              className="h-24 w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Any time constraints?
            </label>
            <div className="flex flex-wrap gap-2">
              {timeConstraints.map((tc) => (
                <button
                  key={tc.value}
                  onClick={() => setTimeConstraint(timeConstraint === tc.value ? null : tc.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    timeConstraint === tc.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {tc.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Require approval for actions?</p>
                <p className="text-xs text-muted-foreground">Agent will ask before taking actions</p>
              </div>
            </div>
            <button
              onClick={() => setRequireApproval(!requireApproval)}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                requireApproval ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                  requireApproval ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!goal.trim()}>
            Start Mission
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
