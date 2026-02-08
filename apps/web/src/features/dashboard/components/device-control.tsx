"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import {
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sun,
  ArrowLeft,
  Home,
  Square,
  Camera,
  Loader2,
  ChevronLeft,
  Maximize2,
  Battery,
  Signal,
  Bot,
  Hand,
  Rocket,
  Send,
  ChevronUp,
  ChevronDown,
  Keyboard,
  RotateCcw,
  Type,
  Play,
  Pause,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/libs/utils"
import { useDevices } from "@/hooks/use-devices"
import { useMissions } from "@/hooks/use-missions"
import { useDeviceScreen } from "@/hooks/use-device-screen"
import type { DeviceActionType, ScreenshotData } from "@/types/motia"
import { toast } from "sonner"

interface DeviceControlProps {
  device: {
    id: string
    name: string
    type?: "android" | "desktop" | "ar-glasses"
  }
  onClose: () => void
}

type ControlMode = "live" | "quick" | "manual"
type VoiceState = "idle" | "listening" | "transcribing" | "processing"

interface Message {
  id: string
  type: "user" | "agent" | "action" | "question"
  content: string
  timestamp: Date
  actionStatus?: "executing" | "completed" | "failed" | "cancelled"
}

interface TapFeedback {
  id: string
  x: number
  y: number
}

export function DeviceControl({ device, onClose }: DeviceControlProps) {
  const { dispatchAction } = useDevices()
  const { createMission, isCreating } = useMissions()
  
  const [screenshotEnabled, setScreenshotEnabled] = useState(true)
  const [screenshotRefreshRate, setScreenshotRefreshRate] = useState(1000)
  const [zoomLevel, setZoomLevel] = useState<'fit' | 50 | 100 | 150>('fit')
  
  const {
    screenshot: liveScreenshot,
    isLoading: isLoadingScreenshot,
    error: screenshotError,
    refresh: refreshScreenshot,
    setRefreshInterval,
    pause: pauseScreenshot,
    resume: resumeScreenshot,
  } = useDeviceScreen({
    deviceId: device.id,
    refreshInterval: screenshotRefreshRate,
    enabled: screenshotEnabled,
  })

  const [mode, setMode] = useState<ControlMode>("live")
  const [voiceState, setVoiceState] = useState<VoiceState>("idle")
  const [transcription, setTranscription] = useState("")
  const [isPushToTalk] = useState(true)
  const [voiceInput, setVoiceInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "agent",
      content: `Connected to ${device.name}. I can see your screen and execute commands. Try "Open Netflix" or switch to manual mode.`,
      timestamp: new Date(),
    },
  ])
  const [isExecuting, setIsExecuting] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [connectionQuality, setConnectionQuality] = useState<"excellent" | "good" | "poor">("excellent")
  const [latency, setLatency] = useState(45)
  const [batteryLevel] = useState(78)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const [manualPointer, setManualPointer] = useState({ x: 0, y: 0, visible: false })
  const [executingActionId, setExecutingActionId] = useState<string | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const recognitionRef = useRef<any | null>(null)

  const [tapFeedbacks, setTapFeedbacks] = useState<TapFeedback[]>([])
  const [showKeyboard, setShowKeyboard] = useState(false)
  const [keyboardInput, setKeyboardInput] = useState("")
  const [taskDescription, setTaskDescription] = useState("")
  const [taskStarted, setTaskStarted] = useState(false)
  const [screenImage, setScreenImage] = useState<string | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (typeof window === "undefined") return

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      console.warn("[v0] Speech recognition not supported in this browser")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onstart = () => {
      setVoiceState("listening")
    }

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join("")

      setTranscription(transcript)

      if (event.results[event.results.length - 1].isFinal) {
        setVoiceState("processing")
        handleVoiceCommand(transcript)
      }
    }

    recognition.onerror = (event: any) => {
      console.error("[v0] Speech recognition error:", event.error)
      setVoiceState("idle")
      setTranscription("")
    }

    recognition.onend = () => {
      if (voiceState === "listening") {
        setVoiceState("idle")
      }
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [voiceState])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showKeyboard) return
      if (e.code === "Space" && isPushToTalk && voiceState === "idle" && mode === "live") {
        e.preventDefault()
        startListening()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (showKeyboard) return
      if (e.code === "Space" && isPushToTalk && voiceState === "listening" && mode === "live") {
        e.preventDefault()
        stopListening()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [voiceState, isPushToTalk, mode, showKeyboard])

  useEffect(() => {
    const interval = setInterval(() => {
      const newLatency = 40 + Math.random() * 20
      setLatency(Math.round(newLatency))

      if (newLatency > 200) {
        setConnectionQuality("poor")
        setConnectionError("High latency detected")
      } else if (newLatency > 100) {
        setConnectionQuality("good")
        setConnectionError(null)
      } else {
        setConnectionQuality("excellent")
        setConnectionError(null)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (screenshotError) {
      toast.error("Screenshot error", {
        description: screenshotError.message,
      })
    }
  }, [screenshotError])

  const handleToggleScreenshot = () => {
    if (screenshotEnabled) {
      pauseScreenshot()
      setScreenshotEnabled(false)
    } else {
      resumeScreenshot()
      setScreenshotEnabled(true)
    }
  }

  const handleRefreshRateChange = (rate: number) => {
    setScreenshotRefreshRate(rate)
    setRefreshInterval(rate)
  }

  const handleZoomChange = (zoom: 'fit' | 50 | 100 | 150) => {
    setZoomLevel(zoom)
  }

  const startListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.start()
    }
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }

  const handleMicClick = () => {
    if (voiceState === "idle") {
      startListening()
    } else if (voiceState === "listening") {
      stopListening()
    }
  }

  const handleVoiceCommand = (command: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: command,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setIsExecuting(true)
    setTranscription("")

    setTimeout(() => {
      const actionMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "action",
        content: `Executing: ${command}`,
        timestamp: new Date(),
        actionStatus: "executing",
      }
      setExecutingActionId(actionMessage.id)
      setMessages((prev) => [...prev, actionMessage])

      setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === actionMessage.id ? { ...msg, actionStatus: "completed", content: `Completed: ${command}` } : msg,
          ),
        )
        setIsExecuting(false)
        setVoiceState("idle")
        setExecutingActionId(null)

        const agentMessage: Message = {
          id: (Date.now() + 2).toString(),
          type: "agent",
          content: "Done! What's next?",
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, agentMessage])
      }, 1500)
    }, 500)
  }

  const handleCancelAction = () => {
    if (executingActionId) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === executingActionId
            ? { ...msg, actionStatus: "cancelled", content: msg.content.replace("Executing:", "Cancelled:") }
            : msg,
        ),
      )
      setIsExecuting(false)
      setVoiceState("idle")
      setExecutingActionId(null)

      const cancelMessage: Message = {
        id: Date.now().toString(),
        type: "agent",
        content: "Action cancelled. What would you like to do instead?",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, cancelMessage])
    }
  }

  const handleScreenMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== "manual" || !screenRef.current) return
    const rect = screenRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setManualPointer({ x, y, visible: true })
  }

  const handleScreenClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== "manual" || !screenRef.current) return

    const rect = screenRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Add tap feedback
    const feedbackId = Date.now().toString()
    const xPercent = (x / rect.width) * 100
    const yPercent = (y / rect.height) * 100
    setTapFeedbacks((prev) => [...prev, { id: feedbackId, x: xPercent, y: yPercent }])

    // Remove feedback after animation
    setTimeout(() => {
      setTapFeedbacks((prev) => prev.filter((f) => f.id !== feedbackId))
    }, 500)

    try {
      await dispatchAction(device.id, { 
        type: 'tap', 
        payload: { x: Math.round(x), y: Math.round(y) }
      })
      
      const tapMessage: Message = {
        id: feedbackId,
        type: "action",
        content: `Tapped at (${Math.round(x)}, ${Math.round(y)})`,
        timestamp: new Date(),
        actionStatus: "completed",
      }
      setMessages((prev) => [...prev, tapMessage])
    } catch (error) {
      toast.error("Failed to execute tap", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: "action",
        content: `Tap failed at (${Math.round(x)}, ${Math.round(y)})`,
        timestamp: new Date(),
        actionStatus: "failed",
      }
      setMessages((prev) => [...prev, errorMessage])
    }
  }

  const handleScroll = async (direction: "up" | "down") => {
    try {
      await dispatchAction(device.id, { 
        type: 'scroll', 
        payload: { direction }
      })
      
      const scrollMessage: Message = {
        id: Date.now().toString(),
        type: "action",
        content: `Scrolled ${direction}`,
        timestamp: new Date(),
        actionStatus: "completed",
      }
      setMessages((prev) => [...prev, scrollMessage])
    } catch (error) {
      toast.error(`Failed to scroll ${direction}`, {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const handleKeyboardSubmit = async () => {
    if (!keyboardInput.trim()) return

    try {
      await dispatchAction(device.id, { 
        type: 'type', 
        payload: { text: keyboardInput }
      })
      
      const typeMessage: Message = {
        id: Date.now().toString(),
        type: "action",
        content: `Typed: "${keyboardInput}"`,
        timestamp: new Date(),
        actionStatus: "completed",
      }
      setMessages((prev) => [...prev, typeMessage])
      setKeyboardInput("")
      setShowKeyboard(false)
    } catch (error) {
      toast.error("Failed to type text", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const handleScreenshot = async () => {
    try {
      const result = await dispatchAction(device.id, { 
        type: 'screenshot', 
        payload: {}
      })
      
      if (result.success && result.data && typeof result.data === 'object' && 'type' in result.data && result.data.type === 'screenshot') {
        const screenshotData = result.data as ScreenshotData
        setScreenImage(`data:image/${screenshotData.format};base64,${screenshotData.base64}`)
        toast.success("Screenshot captured")
      }
      
      const screenshotMessage: Message = {
        id: Date.now().toString(),
        type: "action",
        content: "Screenshot captured",
        timestamp: new Date(),
        actionStatus: "completed",
      }
      setMessages((prev) => [...prev, screenshotMessage])
    } catch (error) {
      toast.error("Failed to capture screenshot", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const handleQuickAction = async (action: string) => {
    try {
      let actionType: DeviceActionType
      let payload: Record<string, unknown> = {}
      
      switch (action) {
        case 'Home':
          actionType = 'key'
          payload = { key: 'home' }
          break
        case 'Back':
          actionType = 'key'
          payload = { key: 'back' }
          break
        case 'Volume up':
          actionType = 'key'
          payload = { key: 'volume_up' }
          break
        case 'Volume down':
          actionType = 'key'
          payload = { key: 'volume_down' }
          break
        case 'Brightness up':
          actionType = 'key'
          payload = { key: 'brightness_up' }
          break
        case 'Recent apps':
        case 'Show apps':
          actionType = 'key'
          payload = { key: 'app_switch' }
          break
        case 'Screenshot':
        case 'Shot':
        case 'Capture':
          await handleScreenshot()
          return
        case 'Refresh':
          actionType = 'key'
          payload = { key: 'refresh' }
          break
        case 'Navigate up':
          actionType = 'key'
          payload = { key: 'up' }
          break
        case 'Navigate down':
          actionType = 'key'
          payload = { key: 'down' }
          break
        case 'Select':
          actionType = 'key'
          payload = { key: 'enter' }
          break
        default:
          toast.error(`Unknown action: ${action}`)
          return
      }
      
      await dispatchAction(device.id, { type: actionType, payload })
      
      const actionMessage: Message = {
        id: Date.now().toString(),
        type: "action",
        content: action,
        timestamp: new Date(),
        actionStatus: "completed",
      }
      setMessages((prev) => [...prev, actionMessage])
    } catch (error) {
      toast.error(`Failed to execute ${action}`, {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const handleStartTask = async () => {
    if (!taskDescription.trim()) return

    try {
      const mission = await createMission({
        goal: taskDescription,
        metadata: { deviceId: device.id, type: 'quick_task' }
      })
      
      setTaskStarted(true)
      toast.success("Task started", {
        description: `Mission ${mission.id} created. You'll be notified when complete.`,
      })
      
      const taskMessage: Message = {
        id: Date.now().toString(),
        type: "agent",
        content: `Task started: "${taskDescription}". I'll notify you when it's complete. You can close this window now.`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, taskMessage])
    } catch (error) {
      toast.error("Failed to start task", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const getQuickActions = () => {
    const deviceType = device.type || "android"

    const baseActions = [
      { icon: ArrowLeft, label: "Back", action: "Back" },
      { icon: Home, label: "Home", action: "Home" },
    ]

    if (deviceType === "ar-glasses") {
      return [
        ...baseActions,
        { icon: ChevronUp, label: "Up", action: "Navigate up" },
        { icon: ChevronDown, label: "Down", action: "Navigate down" },
        { icon: Square, label: "Select", action: "Select" },
        { icon: Camera, label: "Capture", action: "Screenshot" },
      ]
    }

    if (deviceType === "desktop") {
      return [
        ...baseActions,
        { icon: Square, label: "Apps", action: "Show apps" },
        { icon: Camera, label: "Screenshot", action: "Screenshot" },
        { icon: RotateCcw, label: "Refresh", action: "Refresh" },
      ]
    }

    // Android/default
    return [
      { icon: Volume2, label: "Vol+", action: "Volume up" },
      { icon: VolumeX, label: "Vol-", action: "Volume down" },
      { icon: Sun, label: "Bright", action: "Brightness up" },
      ...baseActions,
      { icon: Square, label: "Apps", action: "Recent apps" },
      { icon: Camera, label: "Shot", action: "Screenshot" },
    ]
  }

  const quickActions = getQuickActions()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 md:p-4">
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl transition-all",
          isFullscreen ? "h-full w-full" : "h-full w-full md:h-[90vh] md:max-w-6xl",
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-secondary/30 px-3 py-2 md:px-4 md:py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
            <button
              onClick={onClose}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4 md:h-5 md:w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-foreground md:text-base">{device.name}</h3>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground md:gap-2 md:text-xs">
                <span className="flex items-center gap-1">
                  <Signal
                    className={cn(
                      "h-2.5 w-2.5 md:h-3 md:w-3",
                      connectionQuality === "excellent" && "text-primary",
                      connectionQuality === "good" && "text-warning",
                      connectionQuality === "poor" && "text-destructive",
                    )}
                  />
                  <span className="hidden sm:inline">{latency}ms</span>
                </span>
                <span className="hidden sm:inline">•</span>
                <Battery className="h-2.5 w-2.5 md:h-3 md:w-3" />
                <span>{batteryLevel}%</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 md:gap-2">
            {/* Mode Switcher */}
            <div className="flex rounded-lg border border-border bg-secondary/30 p-0.5 md:p-1">
              <button
                onClick={() => setMode("live")}
                className={cn(
                  "rounded-md px-2 py-1 text-[10px] font-medium transition-colors md:px-3 md:text-xs",
                  mode === "live"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Bot className="mr-0.5 inline h-2.5 w-2.5 md:mr-1 md:h-3 md:w-3" />
                AI
              </button>
              <button
                onClick={() => setMode("manual")}
                className={cn(
                  "rounded-md px-2 py-1 text-[10px] font-medium transition-colors md:px-3 md:text-xs",
                  mode === "manual"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Hand className="mr-0.5 inline h-2.5 w-2.5 md:mr-1 md:h-3 md:w-3" />
                Manual
              </button>
              <button
                onClick={() => setMode("quick")}
                className={cn(
                  "rounded-md px-2 py-1 text-[10px] font-medium transition-colors md:px-3 md:text-xs",
                  mode === "quick"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Rocket className="mr-0.5 inline h-2.5 w-2.5 md:mr-1 md:h-3 md:w-3" />
                Task
              </button>
            </div>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:block"
            >
              {isFullscreen ? <ChevronLeft className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Connection Error Banner */}
        {connectionError && (
          <div className="shrink-0 border-b border-destructive/20 bg-destructive/10 px-4 py-2">
            <p className="text-sm text-destructive">{connectionError}</p>
          </div>
        )}

        {/* Main Content */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          {/* Device Screen Preview */}
          <div className="flex shrink-0 items-center justify-center bg-background p-2 md:flex-1 md:p-4">
            <div className="relative flex h-48 w-full max-w-[280px] flex-col overflow-hidden rounded-xl border-2 border-border bg-secondary/20 shadow-2xl md:h-full md:max-w-[400px] md:rounded-2xl md:border-4">
              {/* Device Screen Mockup */}
              <div
                ref={screenRef}
                className={cn(
                  "relative flex-1 overflow-hidden bg-gradient-to-br from-background to-secondary/30",
                  mode === "manual" && "cursor-crosshair",
                )}
                onMouseMove={handleScreenMouseMove}
                onClick={handleScreenClick}
                onMouseLeave={() => setManualPointer((prev) => ({ ...prev, visible: false }))}
              >
                {liveScreenshot || screenImage ? (
                  <div className="relative h-full w-full">
                    <div className={cn(
                      "flex h-full w-full items-center justify-center",
                      zoomLevel === 'fit' && "p-0",
                      zoomLevel === 50 && "p-2",
                      zoomLevel === 100 && "p-2",
                      zoomLevel === 150 && "p-2"
                    )}>
                      <img 
                        src={liveScreenshot || screenImage || ''} 
                        alt="Device screen" 
                        className={cn(
                          "transition-all",
                          zoomLevel === 'fit' && "h-full w-full object-contain",
                          zoomLevel === 50 && "max-h-full object-contain" && "w-1/2",
                          zoomLevel === 100 && "max-h-full object-contain" && "w-full",
                          zoomLevel === 150 && "max-h-full object-contain" && "w-[150%]"
                        )}
                        style={{
                          imageRendering: 'crisp-edges',
                        }}
                      />
                    </div>
                    
                    <div className="absolute left-2 top-2 flex gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 gap-1 px-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleScreenshot()
                        }}
                      >
                        {screenshotEnabled ? (
                          <Pause className="h-3 w-3" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                      </Button>
                      
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 gap-1 px-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          refreshScreenshot()
                        }}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="absolute right-2 top-2 flex flex-col gap-1">
                      <select
                        value={screenshotRefreshRate}
                        onChange={(e) => {
                          e.stopPropagation()
                          const rate = Number(e.target.value)
                          if (rate === 0) {
                            handleToggleScreenshot()
                          } else {
                            handleRefreshRateChange(rate)
                          }
                        }}
                        className="h-8 rounded-md border border-border bg-secondary px-2 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value={500}>0.5s</option>
                        <option value={1000}>1s</option>
                        <option value={2000}>2s</option>
                        <option value={5000}>5s</option>
                        <option value={0}>Manual</option>
                      </select>

                      <select
                        value={zoomLevel}
                        onChange={(e) => {
                          e.stopPropagation()
                          const value = e.target.value
                          handleZoomChange(value === 'fit' ? 'fit' : Number(value) as 50 | 100 | 150)
                        }}
                        className="h-8 rounded-md border border-border bg-secondary px-2 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="fit">Fit</option>
                        <option value={50}>50%</option>
                        <option value={100}>100%</option>
                        <option value={150}>150%</option>
                      </select>
                    </div>

                    {isLoadingScreenshot && (
                      <div className="absolute bottom-2 right-2">
                        <div className="flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-xs">Updating...</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-full flex-col p-2 md:p-4">
                    {isLoadingScreenshot ? (
                      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground md:h-12 md:w-12" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Loading screen...</p>
                          <p className="mt-1 text-xs text-muted-foreground">Fetching first screenshot</p>
                        </div>
                      </div>
                    ) : mode === "manual" ? (
                      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                        <Camera className="h-8 w-8 text-muted-foreground md:h-12 md:w-12" />
                        <div>
                          <p className="text-sm font-medium text-foreground">No screenshot available</p>
                          <p className="mt-1 text-xs text-muted-foreground">Live updates are {screenshotEnabled ? 'enabled' : 'paused'}</p>
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            refreshScreenshot()
                          }}
                          size="sm"
                        >
                          <RotateCcw className="mr-2 h-3 w-3" />
                          Refresh Now
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="mb-2 flex items-center justify-between md:mb-4">
                          <div className="text-lg font-bold text-red-500 md:text-2xl">NETFLIX</div>
                          <div className="flex gap-1 md:gap-2">
                            <div className="h-6 w-6 rounded-md bg-secondary md:h-8 md:w-8" />
                            <div className="h-6 w-6 rounded-md bg-secondary md:h-8 md:w-8" />
                          </div>
                        </div>
                        <div className="grid flex-1 grid-cols-2 gap-2 md:gap-3">
                          {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="aspect-video rounded-lg bg-secondary" />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Manual Control Pointer */}
                {mode === "manual" && manualPointer.visible && (
                  <div
                    className="pointer-events-none absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-primary/20"
                    style={{ left: `${manualPointer.x}%`, top: `${manualPointer.y}%` }}
                  />
                )}

                {tapFeedbacks.map((tap) => (
                  <div
                    key={tap.id}
                    className="pointer-events-none absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-primary/40"
                    style={{ left: `${tap.x}%`, top: `${tap.y}%` }}
                  />
                ))}
              </div>

              {/* AI Execution Overlay */}
              {isExecuting && mode !== "manual" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 backdrop-blur-sm">
                  <div className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 md:gap-3 md:px-6 md:py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-primary-foreground md:h-5 md:w-5" />
                    <span className="text-sm font-medium text-primary-foreground md:text-base">Executing...</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelAction}
                    className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Control Panel */}
          <div className="flex min-h-0 flex-1 flex-col border-t border-border bg-secondary/10 md:w-80 md:border-l md:border-t-0 lg:w-96">
            {/* Mode Description */}
            <div className="shrink-0 border-b border-border bg-secondary/30 p-3 md:p-4">
              {mode === "live" && (
                <div className="text-xs text-muted-foreground md:text-sm">
                  <Bot className="mb-1 h-3 w-3 text-primary md:mb-2 md:h-4 md:w-4" />
                  <p className="font-medium text-foreground">AI Control Mode</p>
                  <p className="mt-1 text-[11px] leading-relaxed md:text-xs">
                    Voice or text commands. The AI figures out how to navigate and execute.
                  </p>
                </div>
              )}
              {mode === "manual" && (
                <div className="text-xs text-muted-foreground md:text-sm">
                  <Hand className="mb-1 h-3 w-3 text-primary md:mb-2 md:h-4 md:w-4" />
                  <p className="font-medium text-foreground">Manual Control Mode</p>
                  <p className="mt-1 text-[11px] leading-relaxed md:text-xs">
                    Click/tap the screen to control directly. Use quick actions below.
                  </p>
                </div>
              )}
              {mode === "quick" && (
                <div className="text-xs text-muted-foreground md:text-sm">
                  <Rocket className="mb-1 h-3 w-3 text-primary md:mb-2 md:h-4 md:w-4" />
                  <p className="font-medium text-foreground">Quick Task Mode</p>
                  <p className="mt-1 text-[11px] leading-relaxed md:text-xs">
                    Give a task, close this, and get notified when it's done.
                  </p>
                </div>
              )}
            </div>

            {mode === "manual" && (
              <div className="shrink-0 space-y-2 border-b border-border bg-secondary/20 p-2">
                {/* Device-specific quick actions */}
                <div className="grid grid-cols-6 gap-1.5 md:gap-2">
                  {quickActions.map((action) => (
                    <Button
                      key={action.action}
                      variant="ghost"
                      size="sm"
                      className="h-10 flex-col gap-0.5 p-1 md:h-12"
                      onClick={() => handleQuickAction(action.action)}
                    >
                      <action.icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      <span className="text-[9px] md:text-[10px]">{action.label}</span>
                    </Button>
                  ))}
                </div>

                {/* Scroll and keyboard controls */}
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-transparent"
                      onClick={() => handleScroll("up")}
                    >
                      <ChevronUp className="mr-1 h-3 w-3" />
                      Scroll Up
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-transparent"
                      onClick={() => handleScroll("down")}
                    >
                      <ChevronDown className="mr-1 h-3 w-3" />
                      Scroll Down
                    </Button>
                  </div>
                  <Button
                    variant={showKeyboard ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowKeyboard(!showKeyboard)}
                  >
                    <Keyboard className="h-4 w-4" />
                  </Button>
                </div>

                {/* Keyboard input */}
                {showKeyboard && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={keyboardInput}
                      onChange={(e) => setKeyboardInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleKeyboardSubmit()
                        }
                      }}
                      placeholder="Type text to send to device..."
                      className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      autoFocus
                    />
                    <Button size="sm" onClick={handleKeyboardSubmit}>
                      <Type className="mr-1 h-3 w-3" />
                      Send
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Messages - only show in live and manual modes */}
            {mode !== "quick" && (
              <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
                <div className="space-y-2 md:space-y-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn("flex gap-1.5 md:gap-2", message.type === "user" ? "justify-end" : "justify-start")}
                    >
                      {message.type !== "user" && (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 md:h-7 md:w-7">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary md:h-2 md:w-2" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[75%] rounded-lg px-2.5 py-1.5 text-xs md:px-3 md:py-2 md:text-sm",
                          message.type === "user" && "bg-primary text-primary-foreground",
                          message.type === "agent" && "bg-secondary text-foreground",
                          message.type === "action" && "bg-warning/10 text-warning",
                          message.type === "question" && "border border-primary bg-primary/5 text-foreground",
                        )}
                      >
                        {message.actionStatus && (
                          <div className="mb-1 flex items-center gap-1.5">
                            {message.actionStatus === "executing" && (
                              <Loader2 className="h-2.5 w-2.5 animate-spin md:h-3 md:w-3" />
                            )}
                            {message.actionStatus === "completed" && <span className="text-primary">✓</span>}
                            {message.actionStatus === "failed" && <span className="text-destructive">✗</span>}
                            {message.actionStatus === "cancelled" && <span className="text-warning">⊘</span>}
                          </div>
                        )}
                        {message.content}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            )}

            {/* Voice Input (AI mode only) */}
            {mode === "live" && (
              <div className="shrink-0 border-t border-border bg-secondary/30 p-3 md:p-4">
                {/* Voice State Indicator */}
                {voiceState !== "idle" && (
                  <div className="mb-2 flex items-center gap-2 text-sm">
                    {voiceState === "listening" && (
                      <>
                        <div className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                        <span className="text-muted-foreground">
                          Listening... {isPushToTalk && "(release space to send)"}
                        </span>
                      </>
                    )}
                    {voiceState === "transcribing" && (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        <span className="text-muted-foreground">Transcribing...</span>
                      </>
                    )}
                    {voiceState === "processing" && (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        <span className="text-muted-foreground">Processing...</span>
                      </>
                    )}
                  </div>
                )}

                {/* Transcription Preview */}
                {transcription && (
                  <div className="mb-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                    <p className="text-sm text-foreground">{transcription}</p>
                  </div>
                )}

                {/* Input Area */}
                <div className="flex items-center gap-2">
                  <button
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all md:h-12 md:w-12",
                      voiceState === "listening"
                        ? "animate-pulse bg-destructive text-white ring-4 ring-destructive/30"
                        : voiceState === "processing"
                          ? "bg-primary/50 text-primary-foreground"
                          : "bg-primary text-primary-foreground hover:bg-primary/90",
                    )}
                    onClick={handleMicClick}
                    disabled={isExecuting || voiceState === "processing"}
                  >
                    {voiceState === "listening" ? (
                      <MicOff className="h-4 w-4 md:h-5 md:w-5" />
                    ) : voiceState === "processing" ? (
                      <Loader2 className="h-4 w-4 animate-spin md:h-5 md:w-5" />
                    ) : (
                      <Mic className="h-4 w-4 md:h-5 md:w-5" />
                    )}
                  </button>
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder={
                        voiceState === "listening"
                          ? "Listening..."
                          : isPushToTalk
                            ? "Hold spacebar or tap mic"
                            : "Type or speak..."
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 md:text-sm"
                      value={voiceInput}
                      onChange={(e) => setVoiceInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && voiceInput && voiceState === "idle") {
                          handleVoiceCommand(voiceInput)
                          setVoiceInput("")
                        }
                      }}
                      disabled={isExecuting || voiceState !== "idle"}
                    />
                  </div>
                </div>

                {/* Quick Commands */}
                <div className="mt-2 flex flex-wrap gap-1.5 md:mt-3 md:gap-2">
                  {["Open Netflix", "Scroll down", "Go back", "Search for..."].map((cmd) => (
                    <button
                      key={cmd}
                      onClick={() => handleVoiceCommand(cmd)}
                      className="rounded-md border border-border bg-secondary/50 px-2 py-1 text-[10px] text-foreground transition-colors hover:bg-secondary disabled:opacity-50 md:text-xs"
                      disabled={isExecuting || voiceState !== "idle"}
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "quick" && (
              <div className="flex flex-1 flex-col p-3 md:p-4">
                {!taskStarted ? (
                  <div className="flex flex-1 flex-col space-y-3">
                    <textarea
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value)}
                      placeholder="Describe the task you want completed...

Examples:
• Download my bank statement from Chase
• Find all PDF attachments in my email
• Take a screenshot every 5 minutes for an hour
• Search for 'React tutorials' and save the top 5 links"
                      className="min-h-[120px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="shrink-0 space-y-2">
                      <Button className="w-full" onClick={handleStartTask} disabled={!taskDescription.trim() || isCreating}>
                        {isCreating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Starting...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Start Task
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        You can close this window. You'll get a notification when the task is complete.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center space-y-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                      <Rocket className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Task Running</h4>
                      <p className="mt-1 text-sm text-muted-foreground">
                        "{taskDescription.slice(0, 50)}
                        {taskDescription.length > 50 ? "..." : ""}"
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">You'll receive a notification when complete.</p>
                    <Button variant="outline" onClick={onClose}>
                      Close Window
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
