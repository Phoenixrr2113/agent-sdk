"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Zap, Clock } from "lucide-react"
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

interface AutomationContextModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const frequencies = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "on_event", label: "On event" },
  { value: "manual", label: "Manual" },
] as const

export function AutomationContextModal({ open, onOpenChange }: AutomationContextModalProps) {
  const router = useRouter()
  const [goal, setGoal] = useState("")
  const [frequency, setFrequency] = useState<string | null>(null)

  const handleSubmit = () => {
    if (!goal.trim()) return

    const params = new URLSearchParams({
      type: "automation",
      goal: goal.trim(),
    })
    if (frequency) {
      params.set("frequency", frequency)
    }

    onOpenChange(false)
    router.push(`/dashboard/chat?${params.toString()}`)
  }

  const handleClose = () => {
    setGoal("")
    setFrequency(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>New Automation</DialogTitle>
              <DialogDescription>
                Describe what you want to automate
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              What would you like to automate?
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g., Send daily digest email with latest news"
              className="h-24 w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Clock className="h-4 w-4 text-muted-foreground" />
              How often?
            </label>
            <div className="flex flex-wrap gap-2">
              {frequencies.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFrequency(frequency === f.value ? null : f.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    frequency === f.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!goal.trim()}>
            Create Automation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
