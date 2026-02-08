"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { AgentChat } from "@/features/dashboard/components/agent-chat"

function ChatContent() {
  const searchParams = useSearchParams()

  const type = searchParams.get("type") as "mission" | "automation" | null
  const goal = searchParams.get("goal")
  const timeConstraint = searchParams.get("timeConstraint")
  const requireApproval = searchParams.get("requireApproval") === "true"
  const frequency = searchParams.get("frequency")

  const initialContext = type && goal ? {
    type,
    goal,
    timeConstraint: timeConstraint || undefined,
    requireApproval,
    frequency: frequency || undefined,
  } : null

  return <AgentChat initialContext={initialContext} />
}

export default function ChatPage() {
  return (
    <div className="flex h-full w-full">
      <Suspense fallback={<div className="flex h-full w-full items-center justify-center">Loading...</div>}>
        <ChatContent />
      </Suspense>
    </div>
  )
}
