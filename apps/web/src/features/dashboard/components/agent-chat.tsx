"use client"

import { useState, useEffect, useRef } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, isTextUIPart, isToolUIPart, isReasoningUIPart, isFileUIPart, getToolName } from "ai"
import { Bot, MessageSquare, CopyIcon, RefreshCcwIcon, AlertCircle } from "lucide-react"
import { cn } from "@/libs/utils"
import { useMissions } from "@/hooks/use-missions"
import { useConversation } from "@/hooks/use-conversations"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
  MessageAttachment,
  MessageAttachments,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputTools,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
  PromptInputHeader,
  PromptInputAttachments,
  PromptInputAttachment,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning"
import { Loader } from "@/components/ai-elements/loader"
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion"
import { ToolPartRenderer } from "./message-parts"

const suggestionPrompts = [
  "Find rental properties in Austin under $300K",
  "Apply to 20 remote React developer jobs",
  "Monitor competitor pricing changes",
  "Research AI trends and draft a report",
]

interface AgentChatProps {
  className?: string
  initialContext?: ChatContext | null
}

interface ChatContext {
  type: 'mission' | 'automation'
  goal: string
  timeConstraint?: string
  requireApproval?: boolean
  frequency?: string
}



const MAIN_CONVERSATION_ID = "main"

export function AgentChat({ className: _className, initialContext }: AgentChatProps) {
  const [input, setInput] = useState("")
  const [hasAutoSentContext, setHasAutoSentContext] = useState(false)
  const { missions, refetch: refreshMissions } = useMissions()
  const { saveMessage } = useConversation(MAIN_CONVERSATION_ID)
  
  // Track if we've saved messages to avoid duplicates
  const savedMessageIds = useRef(new Set<string>())

  const { messages, sendMessage, status, regenerate, addToolApprovalResponse } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
    onFinish: () => {
      // Refresh missions when chat completes (may have created new ones)
      refreshMissions()
    },
  })

  // Auto-send initial context as first message
  useEffect(() => {
    if (initialContext && !hasAutoSentContext && messages.length === 0) {
      const contextMessage = initialContext.type === 'mission'
        ? `I want to create a new mission: ${initialContext.goal}${initialContext.timeConstraint ? `. Time constraint: ${initialContext.timeConstraint}` : ''}${initialContext.requireApproval ? '. Please require approval for all actions.' : ''}`
        : `I want to create a new automation: ${initialContext.goal}${initialContext.frequency ? `. Frequency: ${initialContext.frequency}` : ''}`
      
      sendMessage({ text: contextMessage })
      setHasAutoSentContext(true)
    }
  }, [initialContext, hasAutoSentContext, messages.length, sendMessage])

  // Save messages after they appear
  useEffect(() => {
    if (messages.length === 0) return

    // Save any new messages that haven't been saved yet
    messages.forEach((message) => {
      if (savedMessageIds.current.has(message.id)) return

      const textParts = message.parts?.filter(isTextUIPart) ?? []
      const toolParts = message.parts?.filter(isToolUIPart) ?? []
      const content = textParts.map(p => p.text).join('\n')
      
      if (content || toolParts.length > 0) {
        const toolCalls = toolParts.map(part => ({
          id: part.toolCallId,
          name: getToolName(part),
          arguments: part.input as Record<string, unknown>,
          result: part.state === 'output-available' ? part.output : undefined,
        }))

        saveMessage({
          role: message.role,
          content,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        }).then(() => {
          savedMessageIds.current.add(message.id)
        }).catch(err => {
          console.error('Failed to save message:', err)
        })
      }
    })
  }, [messages, saveMessage])

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text?.trim())
    const hasAttachments = Boolean(message.files?.length)

    if (!(hasText || hasAttachments)) return

    sendMessage({
      text: message.text || "Sent with attachments",
      files: message.files
    })
    setInput("")
  }

  const handleSuggestionClick = (prompt: string) => {
    sendMessage({ text: prompt })
  }

  const isStreaming = status === "streaming"
  const isSubmitted = status === "submitted"

  // Show mission status updates
  const activeMissions = missions.filter((m) => m.status === "executing" || m.status === "awaiting_approval")
  const needsApproval = missions.filter((m) => m.status === "awaiting_approval")

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-card">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3 sm:gap-3 sm:px-6 sm:py-4">
        <div className="relative">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 sm:h-9 sm:w-9">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
              isStreaming ? "animate-pulse bg-warning" : "bg-primary"
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="truncate text-sm font-medium text-foreground sm:text-base">ControlAI Agent</h2>
          <p className="truncate text-xs text-muted-foreground">
            {isStreaming ? "Thinking..." : isSubmitted ? "Processing..." : activeMissions.length > 0 ? `${activeMissions.length} active missions` : "Online"}
          </p>
        </div>
        {needsApproval.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1 sm:gap-2 sm:px-3 sm:py-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500 sm:h-4 sm:w-4" />
            <span className="text-xs font-medium text-amber-500 sm:text-sm">{needsApproval.length}</span>
          </div>
        )}
      </div>

      <Conversation className="flex min-h-0 flex-1 flex-col">
        <ConversationContent className="flex-1 space-y-3 p-3 sm:space-y-4 sm:p-4">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<MessageSquare className="size-10 text-primary sm:size-12" />}
              title="Start a conversation"
              description="I'm your ControlAI agent. I can handle complex tasks autonomously across your connected devices."
            />
          ) : (
            messages.map((message) => {
              const parts = message.parts || []
              const fileParts = parts.filter(isFileUIPart)
              const allTextContent = parts
                .filter(isTextUIPart)
                .map((p) => p.text)
                .join("\n")

              return (
                <Message from={message.role} key={message.id}>
                  {fileParts.length > 0 && (
                    <MessageAttachments className="mb-2">
                      {fileParts.map((filePart) => (
                        <MessageAttachment data={filePart} key={filePart.url || filePart.filename} />
                      ))}
                    </MessageAttachments>
                  )}
                  {parts.map((part, idx) => {
                    if (isReasoningUIPart(part)) {
                      return (
                        <Reasoning key={`reasoning-${idx}`}>
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      )
                    }
                    if (isToolUIPart(part)) {
                      return (
                        <ToolPartRenderer
                          key={part.toolCallId}
                          toolPart={part}
                          isStreaming={isStreaming}
                          onApprove={(approvalId) => addToolApprovalResponse({ id: approvalId, approved: true })}
                          onDeny={(approvalId) => addToolApprovalResponse({ id: approvalId, approved: false })}
                        />
                      )
                    }
                    if (isTextUIPart(part)) {
                      return (
                        <MessageContent key={`text-${idx}`}>
                          {message.role === "assistant" ? (
                            <MessageResponse>{part.text}</MessageResponse>
                          ) : (
                            part.text
                          )}
                        </MessageContent>
                      )
                    }
                    return null
                  })}
                  {message.role === "assistant" && allTextContent && (
                    <MessageActions>
                      <MessageAction
                        label="Copy"
                        onClick={() => navigator.clipboard.writeText(allTextContent)}
                        tooltip="Copy to clipboard"
                      >
                        <CopyIcon className="size-4" />
                      </MessageAction>
                      <MessageAction
                        label="Retry"
                        onClick={() => regenerate()}
                        tooltip="Regenerate response"
                      >
                        <RefreshCcwIcon className="size-4" />
                      </MessageAction>
                    </MessageActions>
                  )}
                  {message.role === "user" && allTextContent && (
                    <MessageActions>
                      <MessageAction
                        label="Copy"
                        onClick={() => navigator.clipboard.writeText(allTextContent)}
                        tooltip="Copy message"
                      >
                        <CopyIcon className="size-4" />
                      </MessageAction>
                    </MessageActions>
                  )}
                </Message>
              )
            })
          )}
          {isStreaming && (
            <Message from="assistant">
              <MessageContent>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                  </div>
                  <span className="text-sm">AI is thinking...</span>
                </div>
              </MessageContent>
            </Message>
          )}
          {isSubmitted && <Loader />}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="grid shrink-0 gap-3 border-t border-border pt-3 sm:gap-4 sm:pt-4">
        {messages.length === 0 && (
          <Suggestions className="px-3 sm:px-4">
            {suggestionPrompts.map((prompt) => (
              <Suggestion
                key={prompt}
                onClick={() => handleSuggestionClick(prompt)}
                suggestion={prompt}
              />
            ))}
          </Suggestions>
        )}
        <div className="w-full px-3 pb-3 sm:px-4 sm:pb-4">
          <PromptInput onSubmit={handleSubmit} globalDrop multiple>
            <PromptInputHeader>
              <PromptInputAttachments>
                {(attachment) => <PromptInputAttachment data={attachment} />}
              </PromptInputAttachments>
            </PromptInputHeader>
            <PromptInputBody>
              <PromptInputTextarea
                onChange={(e) => setInput(e.target.value)}
                value={input}
                className="min-h-[44px] sm:min-h-[48px]"
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
              </PromptInputTools>
              <PromptInputSubmit
                disabled={!input.trim() && status !== "streaming"}
                status={status}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  )
}
