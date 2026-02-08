"use client"

import { useState } from "react"
import {
  Smartphone,
  MonitorIcon,
  Laptop,
  Plus,
  MoreVertical,
  Wifi,
  Eye,
  Usb,
  RefreshCw,
  X,
  Copy,
  Check,
  Download,
  Phone,
  Loader2,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/libs/utils"
import { DeviceControl } from "./device-control"
import { useDevices, type Device as APIDevice } from "@/hooks/use-devices"

interface DevicesPanelProps {
  showEmptyState?: boolean
}

const deviceIcons = {
  android: Smartphone,
  ios: Smartphone,
  windows: MonitorIcon,
  macos: Laptop,
  desktop: MonitorIcon,
  web: MonitorIcon,
}

const statusConfig = {
  connected: { color: "bg-primary", label: "Online" },
  disconnected: { color: "bg-muted-foreground", label: "Offline" },
  busy: { color: "bg-warning", label: "In Use" },
}

function getDeviceStatus(device: APIDevice): "connected" | "disconnected" | "busy" {
  // Check if device is connected based on connection status
  const connectionStatus = device.connection?.status
  if (connectionStatus === "connected") return "connected"
  if (connectionStatus === "connecting") return "connected" // Treat connecting as connected for UI
  return "disconnected"
}

function getConnectionType(device: APIDevice): "webusb" | "agent" {
  if (device.platform === "android" || device.platform === "ios") return "webusb"
  return "agent"
}

const connectionConfig = {
  webusb: { label: "WebUSB", icon: Usb },
  agent: { label: "Agent", icon: Wifi },
}

export function DevicesPanel({ showEmptyState = false }: DevicesPanelProps) {
  const { devices: apiDevices, isLoading, refetch } = useDevices()
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [connectStep, setConnectStep] = useState<"choose" | "android" | "desktop">("choose")
  const [copied, setCopied] = useState(false)
  const [controllingDevice, setControllingDevice] = useState<APIDevice | null>(null)
  const [checkingAgent, setCheckingAgent] = useState(false)

  const devices = showEmptyState ? [] : apiDevices.map((d) => ({
    ...d,
    type: d.platform,
    status: getDeviceStatus(d),
    lastSeen: d.connection?.lastSeenAt
      ? new Date(d.connection.lastSeenAt).toLocaleString()
      : "Never",
    ip: undefined, // IP address not in current type
    connection: getConnectionType(d),
  }))

  const onlineCount = devices.filter((d) => d.status !== "disconnected").length
  const busyCount = devices.filter((d) => d.status === "busy").length

  const handleCopyCommand = () => {
    navigator.clipboard.writeText("curl -fsSL https://get.controlai.dev | sh")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCloseModal = () => {
    setShowConnectModal(false)
    setConnectStep("choose")
  }

  const handleCheckForAgent = async () => {
    setCheckingAgent(true)
    await refetch()
    setCheckingAgent(false)
    const hasDesktopAgent = apiDevices.some(
      (d) => d.platform === "desktop" && d.connection?.status === "connected"
    )
    if (hasDesktopAgent) {
      handleCloseModal()
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Devices</h2>
          <p className="text-sm text-muted-foreground">
            {devices.length === 0
              ? "Control any device from this browser"
              : `${onlineCount} online${busyCount > 0 ? `, ${busyCount} in use` : ""}`}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => setShowConnectModal(true)}
        >
          <Plus className="h-4 w-4" />
          Connect Device
        </Button>
      </div>

      {/* Device List or Empty State */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading devices...</p>
          </div>
        ) : devices.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <MonitorIcon className="h-10 w-10 text-primary" />
            </div>
            <div className="max-w-sm">
              <h3 className="text-lg font-semibold text-foreground">Connect your first device</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Connect your phone, AR glasses, computer, or any device. Control them all from this browser using voice
                or text commands.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="gap-2 bg-transparent"
                onClick={() => {
                  setShowConnectModal(true)
                  setConnectStep("android")
                }}
              >
                <Smartphone className="h-4 w-4" />
                Android
              </Button>
              <Button
                className="gap-2"
                onClick={() => {
                  setShowConnectModal(true)
                  setConnectStep("desktop")
                }}
              >
                <Laptop className="h-4 w-4" />
                Computer
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {devices.map((device) => {
              const Icon = deviceIcons[device.type as keyof typeof deviceIcons] || MonitorIcon
              const ConnectionIcon = connectionConfig[device.connection].icon
              const status = statusConfig[device.status]
              const isSelected = selectedDevice === device.id
              const isAvailable = device.status !== "disconnected"

              return (
                <Card
                  key={device.id}
                  className={cn(
                    "cursor-pointer border-border bg-secondary/20 transition-all hover:border-primary/40",
                    isSelected && "border-primary ring-1 ring-primary/50",
                  )}
                  onClick={() => setSelectedDevice(device.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-lg",
                            isAvailable ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground",
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">{device.name}</h3>
                          <div className="flex items-center gap-1.5">
                            <span className={cn("h-1.5 w-1.5 rounded-full", status.color)} />
                            <span className="text-xs text-muted-foreground">{status.label}</span>
                            {device.status !== "disconnected" && (
                              <span className="text-xs text-muted-foreground">• {device.lastSeen}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1">
                        <ConnectionIcon className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {connectionConfig[device.connection].label}
                        </span>
                      </div>

                      {isAvailable ? (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 px-2 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 gap-1 px-3 text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              const originalDevice = apiDevices.find(d => d.id === device.id)
                              if (originalDevice) setControllingDevice(originalDevice)
                            }}
                          >
                            <Phone className="h-3 w-3" />
                            Control
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <RefreshCw className="h-3 w-3" />
                          Reconnect
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {connectStep === "choose"
                  ? "Connect a Device"
                  : connectStep === "android"
                    ? "Connect Android Device"
                    : "Connect Computer"}
              </h3>
              <button
                onClick={handleCloseModal}
                className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {connectStep === "choose" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setConnectStep("android")}
                  className="flex flex-col items-center gap-3 rounded-xl border border-border bg-secondary/30 p-6 text-center transition-all hover:border-primary/50 hover:bg-secondary/50"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <Smartphone className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Android Phone</h4>
                    <p className="mt-1 text-xs text-muted-foreground">Connect via USB cable</p>
                  </div>
                </button>
                <button
                  onClick={() => setConnectStep("desktop")}
                  className="flex flex-col items-center gap-3 rounded-xl border border-border bg-secondary/30 p-6 text-center transition-all hover:border-primary/50 hover:bg-secondary/50"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <Laptop className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Computer</h4>
                    <p className="mt-1 text-sm text-muted-foreground">Windows, macOS, or Linux</p>
                  </div>
                </button>
              </div>
            )}

            {connectStep === "android" && (
              <div className="space-y-6">
                <div className="flex items-start gap-4 rounded-lg border border-border bg-secondary/30 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Enable USB Debugging</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Go to Settings → Developer Options → Enable USB Debugging
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4 rounded-lg border border-border bg-secondary/30 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Connect USB Cable</h4>
                    <p className="mt-1 text-sm text-muted-foreground">Plug your phone into this computer via USB</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 rounded-lg border border-border bg-secondary/30 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Allow Connection</h4>
                    <p className="mt-1 text-sm text-muted-foreground">Accept the USB debugging prompt on your phone</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setConnectStep("choose")}>
                    Back
                  </Button>
                  <Button className="flex-1 gap-2">
                    <Usb className="h-4 w-4" />
                    Detect Device
                  </Button>
                </div>
              </div>
            )}

            {connectStep === "desktop" && (
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Install the ControlAI agent on your computer to allow remote control.
                </p>
                <div className="rounded-lg border border-border bg-secondary/30 p-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Run this command in your terminal:</p>
                  <div className="flex items-center gap-2 rounded-md bg-background p-3 font-mono text-sm">
                    <code className="flex-1 text-foreground">curl -fsSL https://get.controlai.dev | sh</code>
                    <button
                      onClick={handleCopyCommand}
                      className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="text-center text-sm text-muted-foreground">or</div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Button variant="outline" className="gap-2 bg-transparent">
                    <Download className="h-4 w-4" />
                    Windows
                  </Button>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    <Download className="h-4 w-4" />
                    macOS
                  </Button>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    <Download className="h-4 w-4" />
                    Linux
                  </Button>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setConnectStep("choose")}>
                    Back
                  </Button>
                  <Button className="flex-1 gap-2" onClick={handleCheckForAgent} disabled={checkingAgent}>
                    <RefreshCw className={cn("h-4 w-4", checkingAgent && "animate-spin")} />
                    {checkingAgent ? "Checking..." : "Check for Agent"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {controllingDevice && <DeviceControl device={controllingDevice} onClose={() => setControllingDevice(null)} />}
    </div>
  )
}
