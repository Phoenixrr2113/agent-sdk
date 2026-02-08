"use client"

import { useState } from "react"
import {
  Smartphone,
  Laptop,
  Usb,
  Wifi,
  Download,
  Copy,
  Check,
  Globe,
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDevices } from "@/hooks/use-devices"
import { useToast } from "@/hooks/use-toast"
import { useWebUSB } from "@/hooks/use-webusb"
import { api } from "@/lib/api"
import type { Device, DevicePlatform } from "@/types/motia"

type DeviceConnectModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type DeviceType = "desktop" | "android" | "web"

export function DeviceConnectModal({ open, onOpenChange }: DeviceConnectModalProps) {
  const [activeTab, setActiveTab] = useState<DeviceType>("desktop")
  const [isConnecting, setIsConnecting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [webUrl, setWebUrl] = useState("")
  const { refetch } = useDevices()
  const { toast } = useToast()
  const { isSupported: isWebUSBSupported, pairDevice, isConnecting: isPairingUSB, error: webUSBError, clearError } = useWebUSB()

  const handleCopyCommand = () => {
    navigator.clipboard.writeText("curl -fsSL https://get.controlai.dev | sh")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleConnectDesktop = async () => {
    setIsConnecting(true)
    try {
      await api.post<{ device: Device }>("/api/devices", {
        name: "Desktop Computer",
        platform: "desktop" as DevicePlatform,
        metadata: {},
      })
      await refetch()
      toast({
        title: "Checking for agent",
        description: "Waiting for desktop agent to connect...",
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Connection failed",
        description: "Unable to detect desktop agent. Please ensure the agent is running.",
        variant: "destructive",
      })
    } finally {
      setIsConnecting(false)
    }
  }

  const handleConnectAndroid = async () => {
    setIsConnecting(true)
    try {
      await api.post<{ device: Device }>("/api/devices", {
        name: "Android Device",
        platform: "android" as DevicePlatform,
        metadata: {},
      })
      await refetch()
      toast({
        title: "Detecting device",
        description: "Checking for connected Android device...",
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Connection failed",
        description: "Unable to detect Android device. Please check USB connection and debugging is enabled.",
        variant: "destructive",
      })
    } finally {
      setIsConnecting(false)
    }
  }

  const handleConnectWebUSB = async () => {
    try {
      await pairDevice()
      
      if (webUSBError) {
        toast({
          title: "WebUSB Connection Failed",
          description: webUSBError,
          variant: "destructive",
        })
        clearError()
        return
      }

      toast({
        title: "Device Paired",
        description: "Android device connected via WebUSB successfully.",
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "WebUSB Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect via WebUSB.",
        variant: "destructive",
      })
    }
  }

  const handleConnectWeb = async () => {
    if (!webUrl.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a URL to control.",
        variant: "destructive",
      })
      return
    }

    setIsConnecting(true)
    try {
      await api.post<{ device: Device }>("/api/devices", {
        name: `Web: ${webUrl}`,
        platform: "web" as DevicePlatform,
        metadata: { url: webUrl },
      })
      await refetch()
      toast({
        title: "Web browser connected",
        description: `Successfully connected to ${webUrl}`,
      })
      setWebUrl("")
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Connection failed",
        description: "Unable to connect to web browser. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsConnecting(false)
    }
  }

  const handleConnect = () => {
    switch (activeTab) {
      case "desktop":
        return handleConnectDesktop()
      case "android":
        return handleConnectAndroid()
      case "web":
        return handleConnectWeb()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Connect a Device</DialogTitle>
          <DialogDescription>
            Choose the type of device you want to control
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DeviceType)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="desktop" className="gap-2">
              <Laptop className="h-4 w-4" />
              Desktop
            </TabsTrigger>
            <TabsTrigger value="android" className="gap-2">
              <Smartphone className="h-4 w-4" />
              Android
            </TabsTrigger>
            <TabsTrigger value="web" className="gap-2">
              <Globe className="h-4 w-4" />
              Web Browser
            </TabsTrigger>
          </TabsList>

          <TabsContent value="desktop" className="space-y-4 pt-4">
            <div className="space-y-4">
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
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Windows
                </Button>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  macOS
                </Button>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Linux
                </Button>
              </div>

              <div className="rounded-lg border border-border bg-secondary/50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Wifi className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-foreground">Agent Connection</h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Once installed, the agent will automatically connect to your account. Click &quot;Connect&quot; to check for the running agent.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="android" className="space-y-4 pt-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your Android device via USB to control it remotely.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-4 rounded-lg border border-border bg-secondary/30 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    1
                  </div>
                  <div className="flex-1">
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
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">Connect USB Cable</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Plug your phone into this computer via USB
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 rounded-lg border border-border bg-secondary/30 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    3
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">Allow Connection</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Accept the USB debugging prompt on your phone
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
                <div className="flex items-start gap-2">
                  <Usb className="h-4 w-4 text-warning mt-0.5" />
                  <div className="flex-1 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">
                      {isWebUSBSupported ? "WebUSB Connection Available" : "WebUSB Not Supported"}
                    </p>
                    <p>
                      {isWebUSBSupported 
                        ? "Connect your Android device directly through the browser without ADB setup."
                        : "Your browser does not support WebUSB. Please use Chrome, Edge, or another Chromium-based browser."
                      }
                    </p>
                  </div>
                </div>
              </div>

              {isWebUSBSupported && (
                <div className="pt-2">
                  <Button 
                    onClick={handleConnectWebUSB} 
                    disabled={isPairingUSB}
                    variant="outline"
                    className="w-full gap-2"
                  >
                    <Usb className="h-4 w-4" />
                    {isPairingUSB ? "Pairing..." : "Connect via WebUSB"}
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="web" className="space-y-4 pt-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Control any website by providing its URL. The browser will open in a controlled environment.
              </p>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Website URL</label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                />
              </div>

              <div className="rounded-lg border border-border bg-secondary/50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Globe className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-foreground">Browser Control</h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      A controlled browser instance will be launched with the specified URL. You can interact with it using voice or text commands.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">Suggested Sites</h4>
                <div className="flex flex-wrap gap-2">
                  {["https://gmail.com", "https://calendar.google.com", "https://linkedin.com"].map((url) => (
                    <button
                      key={url}
                      onClick={() => setWebUrl(url)}
                      className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-foreground hover:border-primary/50 hover:bg-secondary/80"
                    >
                      {url.replace("https://", "")}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isConnecting}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? "Connecting..." : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
