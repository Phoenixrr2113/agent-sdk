"use client"

import { useMemo } from "react"
import type { ToolUIPart, DynamicToolUIPart } from "ai"
import { getToolName as getToolNameFromSdk } from "ai"
import { Renderer } from "@json-render/react"
import type { Spec } from "@json-render/react"
import {
  CheckCircle2Icon,
  CircleIcon,
  CircleDotIcon,
  CircleAlertIcon,
  BrainIcon,
  SearchIcon,
  TerminalIcon,
  FileIcon,
  ClockIcon,
} from "lucide-react"
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
import {
  Confirmation,
  ConfirmationTitle,
  ConfirmationRequest,
  ConfirmationActions,
  ConfirmationAction,
  ConfirmationAccepted,
  ConfirmationRejected,
} from "@/components/ai-elements/confirmation"
import { CodeBlock } from "@/components/ai-elements/code-block"
import { cn } from "@/libs/utils"
import { registry } from "@/lib/chat/registry"

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

type AnyToolPart = ToolUIPart | DynamicToolUIPart

function resolveToolName(part: AnyToolPart): string {
  // Use SDK helper for static tools, fallback for dynamic
  if (part.type === "dynamic-tool") {
    return (part as DynamicToolUIPart).toolName
  }
  try {
    return getToolNameFromSdk(part as ToolUIPart)
  } catch {
    return part.type.replace("tool-", "")
  }
}

// ---------------------------------------------------------------------------
// Plan types + helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Grep output types (from SDK GrepResult)
// ---------------------------------------------------------------------------

interface GrepMatch {
  file: string
  line: number
  column?: number
  text: string
}

interface GrepOutput {
  matches?: GrepMatch[]
  totalMatches?: number
  filesSearched?: number
  truncated?: boolean
}

// ---------------------------------------------------------------------------
// Glob output types (from SDK GlobResult)
// ---------------------------------------------------------------------------

interface GlobFileMatch {
  path: string
  mtime?: number
}

interface GlobOutput {
  files?: GlobFileMatch[]
  totalFiles?: number
  truncated?: boolean
}

// ---------------------------------------------------------------------------
// Shell output types (from SDK ShellResult)
// ---------------------------------------------------------------------------

interface ShellOutput {
  stdout?: string
  stderr?: string
  exitCode?: number
  durationMs?: number
  status?: "success" | "failed"
  hint?: string
}

// ---------------------------------------------------------------------------
// Icon/status helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

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

function parseGrepOutput(output: unknown): GrepOutput | null {
  if (!output) return null
  try {
    const parsed = typeof output === "string" ? JSON.parse(output) : output
    if (parsed && typeof parsed === "object" && "matches" in parsed) {
      return parsed as GrepOutput
    }
    return null
  } catch {
    return null
  }
}

function parseGlobOutput(output: unknown): GlobOutput | null {
  if (!output) return null
  try {
    const parsed = typeof output === "string" ? JSON.parse(output) : output
    if (parsed && typeof parsed === "object" && "files" in parsed) {
      return parsed as GlobOutput
    }
    return null
  } catch {
    return null
  }
}

function parseShellOutput(output: unknown): ShellOutput | null {
  if (!output) return null
  try {
    const parsed = typeof output === "string" ? JSON.parse(output) : output
    if (parsed && typeof parsed === "object" && ("stdout" in parsed || "exitCode" in parsed)) {
      return parsed as ShellOutput
    }
    return null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Plan tool part
// ---------------------------------------------------------------------------

interface PlanToolPartProps {
  toolPart: AnyToolPart
  isStreaming: boolean
}

export function PlanToolPart({ toolPart, isStreaming }: PlanToolPartProps) {
  const planData = parsePlanOutput(toolPart.output)

  if (!planData?.plan) {
    return (
      <Tool defaultOpen={false}>
        <ToolHeader
          title="plan"
          type={toolPart.type as ToolUIPart["type"]}
          state={toolPart.state}
        />
        <ToolContent>
          <ToolInput input={toolPart.input} />
          {(toolPart.state === "output-available" || toolPart.state === "output-error") && (
            <ToolOutput
              output={toolPart.output}
              errorText={toolPart.state === "output-error" ? (toolPart as ToolUIPart).errorText : undefined}
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

// ---------------------------------------------------------------------------
// Thinking / Deep Reasoning tool part
// ---------------------------------------------------------------------------

interface ThinkingToolPartProps {
  toolPart: AnyToolPart
  isStreaming: boolean
}

export function ThinkingToolPart({ toolPart, isStreaming }: ThinkingToolPartProps) {
  const thoughtInput = parseThoughtInput(toolPart.input)

  if (!thoughtInput) {
    return (
      <Tool defaultOpen={false}>
        <ToolHeader
          title="sequential_thinking"
          type={toolPart.type as ToolUIPart["type"]}
          state={toolPart.state}
        />
        <ToolContent>
          <ToolInput input={toolPart.input} />
          {(toolPart.state === "output-available" || toolPart.state === "output-error") && (
            <ToolOutput
              output={toolPart.output}
              errorText={toolPart.state === "output-error" ? (toolPart as ToolUIPart).errorText : undefined}
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

// ---------------------------------------------------------------------------
// Grep tool part — rich search results display
// ---------------------------------------------------------------------------

interface GrepToolPartProps {
  toolPart: AnyToolPart
}

export function GrepToolPart({ toolPart }: GrepToolPartProps) {
  const grepOutput = toolPart.state === "output-available" ? parseGrepOutput(toolPart.output) : null

  return (
    <Tool defaultOpen={toolPart.state === "output-available"}>
      <ToolHeader
        title="grep"
        type={toolPart.type as ToolUIPart["type"]}
        state={toolPart.state}
      />
      <ToolContent>
        {toolPart.input != null && typeof toolPart.input === "object" && (
          <div className="space-y-1 px-4 pt-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <SearchIcon className="size-3.5" />
              <span className="font-medium">
                {(toolPart.input as Record<string, unknown>).pattern as string}
              </span>
            </div>
          </div>
        )}
        {grepOutput?.matches && grepOutput.matches.length > 0 ? (
          <div className="space-y-1 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{grepOutput.totalMatches} matches in {grepOutput.filesSearched} files</span>
              {grepOutput.truncated && (
                <span className="rounded bg-warning/10 px-1.5 py-0.5 text-warning">truncated</span>
              )}
            </div>
            <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-md border bg-muted/30 p-2">
              {grepOutput.matches.map((match, i) => (
                <div key={`${match.file}-${match.line}-${i}`} className="flex gap-2 text-xs font-mono">
                  <span className="shrink-0 text-primary/80">{match.file}:{match.line}</span>
                  <span className="truncate text-foreground">{match.text}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {toolPart.state !== "output-available" && <ToolInput input={toolPart.input} />}
            {(toolPart.state === "output-available" || toolPart.state === "output-error") && (
              <ToolOutput
                output={toolPart.output}
                errorText={toolPart.state === "output-error" ? (toolPart as ToolUIPart).errorText : undefined}
              />
            )}
          </>
        )}
      </ToolContent>
    </Tool>
  )
}

// ---------------------------------------------------------------------------
// Glob tool part — file tree display
// ---------------------------------------------------------------------------

interface GlobToolPartProps {
  toolPart: AnyToolPart
}

export function GlobToolPart({ toolPart }: GlobToolPartProps) {
  const globOutput = toolPart.state === "output-available" ? parseGlobOutput(toolPart.output) : null

  return (
    <Tool defaultOpen={toolPart.state === "output-available"}>
      <ToolHeader
        title="glob"
        type={toolPart.type as ToolUIPart["type"]}
        state={toolPart.state}
      />
      <ToolContent>
        {globOutput?.files && globOutput.files.length > 0 ? (
          <div className="space-y-1 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{globOutput.totalFiles} files found</span>
              {globOutput.truncated && (
                <span className="rounded bg-warning/10 px-1.5 py-0.5 text-warning">truncated</span>
              )}
            </div>
            <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-md border bg-muted/30 p-2">
              {globOutput.files.map((file, i) => (
                <div key={`${file.path}-${i}`} className="flex items-center gap-2 text-xs font-mono">
                  <FileIcon className="size-3 shrink-0 text-muted-foreground" />
                  <span className="truncate text-foreground">{file.path}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {toolPart.state !== "output-available" && <ToolInput input={toolPart.input} />}
            {(toolPart.state === "output-available" || toolPart.state === "output-error") && (
              <ToolOutput
                output={toolPart.output}
                errorText={toolPart.state === "output-error" ? (toolPart as ToolUIPart).errorText : undefined}
              />
            )}
          </>
        )}
      </ToolContent>
    </Tool>
  )
}

// ---------------------------------------------------------------------------
// Shell tool part — terminal-style output
// ---------------------------------------------------------------------------

interface ShellToolPartProps {
  toolPart: AnyToolPart
}

export function ShellToolPart({ toolPart }: ShellToolPartProps) {
  const shellOutput = toolPart.state === "output-available" ? parseShellOutput(toolPart.output) : null

  return (
    <Tool defaultOpen={toolPart.state === "output-available"}>
      <ToolHeader
        title="shell"
        type={toolPart.type as ToolUIPart["type"]}
        state={toolPart.state}
      />
      <ToolContent>
        {toolPart.input != null && typeof toolPart.input === "object" && (
          <div className="flex items-center gap-2 px-4 pt-3">
            <TerminalIcon className="size-3.5 text-muted-foreground" />
            <code className="text-xs font-mono text-foreground">
              {(toolPart.input as Record<string, unknown>).command as string}
            </code>
          </div>
        )}
        {shellOutput ? (
          <div className="space-y-2 p-4">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                shellOutput.exitCode === 0
                  ? "bg-primary/10 text-primary"
                  : "bg-destructive/10 text-destructive"
              )}>
                exit {shellOutput.exitCode}
              </span>
              {shellOutput.durationMs !== undefined && (
                <span className="flex items-center gap-1">
                  <ClockIcon className="size-3" />
                  {shellOutput.durationMs}ms
                </span>
              )}
            </div>
            {shellOutput.stdout && (
              <CodeBlock code={shellOutput.stdout} language="bash" />
            )}
            {shellOutput.stderr && (
              <div className="space-y-1">
                <span className="text-xs font-medium text-destructive/80">stderr</span>
                <div className="max-h-40 overflow-y-auto rounded-md border border-destructive/20 bg-destructive/5 p-2">
                  <pre className="whitespace-pre-wrap text-xs font-mono text-destructive">{shellOutput.stderr}</pre>
                </div>
              </div>
            )}
            {shellOutput.hint && (
              <p className="text-xs italic text-muted-foreground">{shellOutput.hint}</p>
            )}
          </div>
        ) : (
          <>
            {toolPart.state !== "output-available" && !toolPart.input && <ToolInput input={toolPart.input} />}
            {(toolPart.state === "output-available" || toolPart.state === "output-error") && (
              <ToolOutput
                output={toolPart.output}
                errorText={toolPart.state === "output-error" ? (toolPart as ToolUIPart).errorText : undefined}
              />
            )}
          </>
        )}
      </ToolContent>
    </Tool>
  )
}

// ---------------------------------------------------------------------------
// Generative UI tool part — renders json-render specs inline
// ---------------------------------------------------------------------------

interface RenderUISpec {
  root: string
  elements: Record<string, {
    type: string
    props: Record<string, unknown>
    children?: string[]
  }>
}

function parseRenderUIOutput(output: unknown): RenderUISpec | null {
  if (!output) return null
  try {
    const parsed = typeof output === "string" ? JSON.parse(output) : output
    if (parsed && typeof parsed === "object" && "spec" in parsed) {
      const spec = (parsed as { spec: unknown }).spec
      if (spec && typeof spec === "object" && "root" in spec && "elements" in spec) {
        return spec as RenderUISpec
      }
    }
    return null
  } catch {
    return null
  }
}

interface GenerativeUIToolPartProps {
  toolPart: AnyToolPart
  isStreaming: boolean
}

export function GenerativeUIToolPart({ toolPart, isStreaming: _isStreaming }: GenerativeUIToolPartProps) {
  const uiSpec = toolPart.state === "output-available" ? parseRenderUIOutput(toolPart.output) : null

  // Convert our flat elements map to the Spec format that json-render expects
  const spec = useMemo<Spec | null>(() => {
    if (!uiSpec) return null
    return {
      root: uiSpec.root,
      elements: Object.fromEntries(
        Object.entries(uiSpec.elements).map(([key, el]) => [
          key,
          {
            type: el.type,
            props: el.props,
            children: el.children,
          },
        ]),
      ),
    } as Spec
  }, [uiSpec])

  // While the tool is still running, show a loading state
  if (toolPart.state !== "output-available" || !spec) {
    return (
      <Tool defaultOpen>
        <ToolHeader
          title="render_ui"
          type={toolPart.type as ToolUIPart["type"]}
          state={toolPart.state}
        />
        <ToolContent>
          {toolPart.state === "input-available" && (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
              </div>
              Generating UI...
            </div>
          )}
          {toolPart.state === "output-error" && (
            <ToolOutput
              output={toolPart.output}
              errorText={(toolPart as ToolUIPart).errorText}
            />
          )}
        </ToolContent>
      </Tool>
    )
  }

  // Render the generative UI spec
  return (
    <div className="rounded-lg border border-border/50 bg-card/50 p-1">
      <Renderer
        spec={spec}
        registry={registry}
        loading={false}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Confirmation wrapper for approval-requested state
// ---------------------------------------------------------------------------

interface ToolConfirmationProps {
  toolPart: AnyToolPart
  toolName: string
  onApprove?: (approvalId: string) => void
  onDeny?: (approvalId: string) => void
}

export function ToolConfirmation({ toolPart, toolName, onApprove, onDeny }: ToolConfirmationProps) {
  if (toolPart.state !== "approval-requested" && toolPart.state !== "approval-responded" &&
    toolPart.state !== "output-denied") {
    return null
  }

  const approval = "approval" in toolPart ? toolPart.approval : undefined
  if (!approval) return null

  const friendlyName = toolName.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")

  return (
    <Confirmation approval={approval} state={toolPart.state}>
      <ConfirmationTitle>
        <strong>{friendlyName}</strong> requires your approval
      </ConfirmationTitle>

      <ConfirmationRequest>
        <div className="space-y-2">
          {toolPart.input != null && typeof toolPart.input === "object" && (
            <div className="rounded-md bg-muted/50 p-2 text-xs font-mono">
              {JSON.stringify(toolPart.input, null, 2)}
            </div>
          )}
          <ConfirmationActions>
            <ConfirmationAction
              variant="outline"
              onClick={() => onDeny?.(approval.id)}
            >
              Deny
            </ConfirmationAction>
            <ConfirmationAction
              onClick={() => onApprove?.(approval.id)}
            >
              Approve
            </ConfirmationAction>
          </ConfirmationActions>
        </div>
      </ConfirmationRequest>

      <ConfirmationAccepted>
        <span className="text-xs text-primary">✓ Approved</span>
      </ConfirmationAccepted>

      <ConfirmationRejected>
        <span className="text-xs text-destructive">✗ Denied</span>
      </ConfirmationRejected>
    </Confirmation>
  )
}

// ---------------------------------------------------------------------------
// Generic tool part fallback
// ---------------------------------------------------------------------------

interface GenericToolPartProps {
  toolPart: AnyToolPart
  toolName: string
}

export function GenericToolPart({ toolPart, toolName }: GenericToolPartProps) {
  return (
    <Tool defaultOpen={false}>
      <ToolHeader
        title={toolName}
        type={toolPart.type as ToolUIPart["type"]}
        state={toolPart.state}
      />
      <ToolContent>
        <ToolInput input={toolPart.input} />
        {(toolPart.state === "output-available" || toolPart.state === "output-error") && (
          <ToolOutput
            output={toolPart.output}
            errorText={toolPart.state === "output-error" ? (toolPart as ToolUIPart).errorText : undefined}
          />
        )}
      </ToolContent>
    </Tool>
  )
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

interface ToolPartRendererProps {
  toolPart: AnyToolPart
  isStreaming: boolean
  onApprove?: (approvalId: string) => void
  onDeny?: (approvalId: string) => void
}

export function ToolPartRenderer({ toolPart, isStreaming, onApprove, onDeny }: ToolPartRendererProps) {
  const toolName = resolveToolName(toolPart)

  const renderTool = () => {
    switch (toolName) {
      case "plan":
        return <PlanToolPart toolPart={toolPart} isStreaming={isStreaming} />
      case "sequential_thinking":
      case "deep_reasoning":
        return <ThinkingToolPart toolPart={toolPart} isStreaming={isStreaming} />
      case "grep":
        return <GrepToolPart toolPart={toolPart} />
      case "glob":
        return <GlobToolPart toolPart={toolPart} />
      case "shell":
        return <ShellToolPart toolPart={toolPart} />
      case "render_ui":
        return <GenerativeUIToolPart toolPart={toolPart} isStreaming={isStreaming} />
      default:
        return <GenericToolPart toolPart={toolPart} toolName={toolName} />
    }
  }

  return (
    <div className="mb-2 space-y-2">
      {renderTool()}
      <ToolConfirmation
        toolPart={toolPart}
        toolName={toolName}
        onApprove={onApprove}
        onDeny={onDeny}
      />
    </div>
  )
}
