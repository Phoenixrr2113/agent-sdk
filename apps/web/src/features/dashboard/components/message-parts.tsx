"use client"

import type { ToolUIPart } from "ai"
import { CheckCircle2Icon, CircleIcon, CircleDotIcon, CircleAlertIcon, BrainIcon } from "lucide-react"
import {
  Plan,
  PlanHeader,
  PlanTitle,
  PlanDescription,
  PlanContent,
  PlanTrigger,
  PlanAction,
} from "@/components/ai-elements/plan"
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought"
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool"

interface PlanStep {
  name: string
  status: "pending" | "in_progress" | "completed" | "blocked"
  notes?: string
}

interface PlanData {
  title: string
  steps: PlanStep[]
  createdAt: number
  updatedAt: number
}

interface PlanToolOutput {
  message?: string
  plan?: PlanData
  progress?: string
  scopeAssessment?: {
    isLarge: boolean
    stepCount: number
    recommendation: string
  }
}

interface ThoughtInput {
  thought: string
  thoughtNumber: number
  totalThoughts: number
  nextThoughtNeeded: boolean
  isRevision?: boolean
  revisesThought?: number
  branchFromThought?: number
  branchId?: string
}

function getStepIcon(status: PlanStep["status"]) {
  switch (status) {
    case "completed":
      return CheckCircle2Icon
    case "in_progress":
      return CircleDotIcon
    case "blocked":
      return CircleAlertIcon
    default:
      return CircleIcon
  }
}

function getStepStatus(status: PlanStep["status"]): "complete" | "active" | "pending" {
  switch (status) {
    case "completed":
      return "complete"
    case "in_progress":
      return "active"
    default:
      return "pending"
  }
}

function parsePlanOutput(output: unknown): PlanToolOutput | null {
  if (!output) return null

  try {
    const parsed = typeof output === "string" ? JSON.parse(output) : output
    if (parsed && typeof parsed === "object" && "plan" in parsed) {
      return parsed as PlanToolOutput
    }
    return null
  } catch {
    return null
  }
}

function parseThoughtInput(input: unknown): ThoughtInput | null {
  if (!input || typeof input !== "object") return null
  const i = input as Record<string, unknown>
  if (typeof i.thought === "string" && typeof i.thoughtNumber === "number") {
    return i as unknown as ThoughtInput
  }
  return null
}

interface PlanToolPartProps {
  toolPart: ToolUIPart
  isStreaming: boolean
}

export function PlanToolPart({ toolPart, isStreaming }: PlanToolPartProps) {
  const planData = parsePlanOutput(toolPart.output)

  if (!planData?.plan) {
    return (
      <Tool defaultOpen={false}>
        <ToolHeader
          title="plan"
          type={toolPart.type}
          state={toolPart.state}
        />
        <ToolContent>
          <ToolInput input={toolPart.input} />
          {(toolPart.state === "output-available" || toolPart.state === "output-error") && (
            <ToolOutput
              output={toolPart.output}
              errorText={toolPart.state === "output-error" ? (toolPart as any).errorText : undefined}
            />
          )}
        </ToolContent>
      </Tool>
    )
  }

  const { plan, progress } = planData
  const completedCount = plan.steps.filter(s => s.status === "completed").length
  const progressText = progress || `${completedCount}/${plan.steps.length} steps`

  return (
    <Plan defaultOpen isStreaming={isStreaming && toolPart.state === "input-available"}>
      <PlanHeader>
        <div className="space-y-1">
          <PlanTitle>{plan.title}</PlanTitle>
          <PlanDescription>{progressText}</PlanDescription>
        </div>
        <PlanAction>
          <PlanTrigger />
        </PlanAction>
      </PlanHeader>
      <PlanContent>
        <ChainOfThought defaultOpen>
          <ChainOfThoughtContent>
            {plan.steps.map((step, idx) => (
              <ChainOfThoughtStep
                key={`${step.name}-${idx}`}
                icon={getStepIcon(step.status)}
                label={step.name}
                description={step.notes}
                status={getStepStatus(step.status)}
              />
            ))}
          </ChainOfThoughtContent>
        </ChainOfThought>
      </PlanContent>
    </Plan>
  )
}

interface ThinkingToolPartProps {
  toolPart: ToolUIPart
  isStreaming: boolean
}

export function ThinkingToolPart({ toolPart, isStreaming }: ThinkingToolPartProps) {
  const thoughtInput = parseThoughtInput(toolPart.input)

  if (!thoughtInput) {
    return (
      <Tool defaultOpen={false}>
        <ToolHeader
          title="sequential_thinking"
          type={toolPart.type}
          state={toolPart.state}
        />
        <ToolContent>
          <ToolInput input={toolPart.input} />
          {(toolPart.state === "output-available" || toolPart.state === "output-error") && (
            <ToolOutput
              output={toolPart.output}
              errorText={toolPart.state === "output-error" ? (toolPart as any).errorText : undefined}
            />
          )}
        </ToolContent>
      </Tool>
    )
  }

  const { thought, isRevision, branchId } = thoughtInput
  const isActive = isStreaming && toolPart.state === "input-available"

  let label = "Thinking"
  if (isRevision) {
    label = "Reconsidering"
  } else if (branchId) {
    label = `Exploring: ${branchId}`
  }

  return (
    <ChainOfThought defaultOpen>
      <ChainOfThoughtContent>
        <ChainOfThoughtStep
          icon={BrainIcon}
          label={label}
          description={thought}
          status={isActive ? "active" : "complete"}
        />
      </ChainOfThoughtContent>
    </ChainOfThought>
  )
}

interface GenericToolPartProps {
  toolPart: ToolUIPart
  toolName: string
}

export function GenericToolPart({ toolPart, toolName }: GenericToolPartProps) {
  return (
    <Tool defaultOpen={false}>
      <ToolHeader
        title={toolName}
        type={toolPart.type}
        state={toolPart.state}
      />
      <ToolContent>
        <ToolInput input={toolPart.input} />
        {(toolPart.state === "output-available" || toolPart.state === "output-error") && (
          <ToolOutput
            output={toolPart.output}
            errorText={toolPart.state === "output-error" ? (toolPart as any).errorText : undefined}
          />
        )}
      </ToolContent>
    </Tool>
  )
}

interface ToolPartRendererProps {
  toolPart: ToolUIPart
  isStreaming: boolean
}

export function ToolPartRenderer({ toolPart, isStreaming }: ToolPartRendererProps) {
  const toolName = toolPart.type.replace("tool-", "")

  switch (toolName) {
    case "plan":
      return <PlanToolPart toolPart={toolPart} isStreaming={isStreaming} />
    case "sequential_thinking":
      return <ThinkingToolPart toolPart={toolPart} isStreaming={isStreaming} />
    default:
      return <GenericToolPart toolPart={toolPart} toolName={toolName} />
  }
}
