"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { useUser, useClerk } from "@clerk/nextjs"
import {
  User,
  Bell,
  Monitor,
  Shield,
  Palette,
  CreditCard,
  Check,
  Smartphone,
  Laptop,
  Trash2,
  Globe,
  Key,
  LogOut,
  Download,
  Upload,
  Languages,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/libs/utils"
import { useSettings } from "@/hooks/use-settings"
import { useProfile } from "@/hooks/use-profile"
import { useDevices } from "@/hooks/use-devices"
import { useToast } from "@/hooks/use-toast"

type SettingsSection = "profile" | "notifications" | "devices" | "security" | "appearance" | "billing"

const settingsSections = [
  { id: "profile" as const, label: "Profile", icon: User },
  { id: "notifications" as const, label: "Notifications", icon: Bell },
  { id: "devices" as const, label: "Devices", icon: Monitor },
  { id: "security" as const, label: "Security", icon: Shield },
  { id: "appearance" as const, label: "Appearance", icon: Palette },
  { id: "billing" as const, label: "Billing", icon: CreditCard },
]

export function SettingsPanel() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile")

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pt-12 md:pt-0">
      <div className="sticky top-0 z-10 -mx-4 bg-background/95 px-4 pb-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:-mx-6 md:px-6">
        <h1 className="mb-4 text-xl font-semibold text-foreground">Settings</h1>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {settingsSections.map((section) => {
            const Icon = section.icon
            const isActive = activeSection === section.id

            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {section.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1">
        {activeSection === "profile" && <ProfileSettings />}
        {activeSection === "notifications" && <NotificationSettings />}
        {activeSection === "devices" && <DeviceSettings />}
        {activeSection === "security" && <SecuritySettings />}
        {activeSection === "appearance" && <AppearanceSettings />}
        {activeSection === "billing" && <BillingSettings />}
      </div>
    </div>
  )
}

function ProfileSettings() {
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()
  const { profile, updateProfile, isUpdating, isLoading } = useProfile()
  const { devices } = useDevices()
  const { toast } = useToast()
  const [displayName, setDisplayName] = useState("")
  const [bio, setBio] = useState("")
  const [timezone, setTimezone] = useState("")
  const [language, setLanguage] = useState("")
  const [defaultDevice, setDefaultDevice] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || "")
      setBio(profile.bio || "")
      setTimezone(profile.timezone || "America/Los_Angeles")
      setLanguage(profile.language || "en")
    }
  }, [profile])

  const handleSave = async () => {
    try {
      await updateProfile({
        displayName,
        bio,
      })
      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handlePreferencesSave = async () => {
    try {
      await updateProfile({
        timezone,
        language,
      })
      toast({
        title: "Preferences updated",
        description: "Your preferences have been saved successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update preferences. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleExportData = async () => {
    try {
      const response = await fetch('/api/profile/export', {
        method: 'POST',
      })
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `control-ai-data-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast({
          title: "Data exported",
          description: "Your data has been downloaded successfully.",
        })
      } else {
        throw new Error('Export failed')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      })
    }
    setShowExportDialog(false)
  }

  const handleDeleteAccount = async () => {
    try {
      const response = await fetch('/api/profile', {
        method: 'DELETE',
      })
      if (response.ok) {
        toast({
          title: "Account deleted",
          description: "Your account has been permanently deleted.",
        })
        await signOut({ redirectUrl: "/" })
      } else {
        throw new Error('Delete failed')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete account. Please try again.",
        variant: "destructive",
      })
    }
    setShowDeleteConfirm(false)
  }

  const handleSignOut = async () => {
    await signOut({ redirectUrl: "/" })
  }

  const getInitials = () => {
    if (user?.fullName) {
      const parts = user.fullName.split(" ")
      if (parts.length >= 2 && parts[0] && parts[1]) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      }
      return user.fullName.substring(0, 2).toUpperCase()
    }
    if (profile?.displayName) {
      const parts = profile.displayName.split(" ")
      if (parts.length >= 2 && parts[0] && parts[1]) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      }
      return profile.displayName.substring(0, 2).toUpperCase()
    }
    return "U"
  }

  const timezones = [
    { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
    { value: "America/Denver", label: "Mountain Time (MT)" },
    { value: "America/Chicago", label: "Central Time (CT)" },
    { value: "America/New_York", label: "Eastern Time (ET)" },
    { value: "Europe/London", label: "London (GMT)" },
    { value: "Europe/Paris", label: "Paris (CET)" },
    { value: "Asia/Tokyo", label: "Tokyo (JST)" },
    { value: "Asia/Shanghai", label: "Shanghai (CST)" },
    { value: "Australia/Sydney", label: "Sydney (AEDT)" },
    { value: "UTC", label: "UTC" },
  ]

  const languages = [
    { value: "en", label: "English" },
    { value: "es", label: "Español" },
    { value: "fr", label: "Français" },
    { value: "de", label: "Deutsch" },
    { value: "ja", label: "日本語" },
    { value: "zh", label: "中文" },
  ]

  if (isLoading || !isLoaded) {
    return <div className="text-sm text-muted-foreground">Loading profile...</div>
  }

  const userEmail = user?.emailAddresses?.[0]?.emailAddress || ""

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Your account information and authentication</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={user.fullName || "User"}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
                {getInitials()}
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{user?.fullName || user?.firstName || "User"}</p>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            </div>
            <Button variant="outline" size="sm" disabled>
              <Upload className="mr-2 h-4 w-4" />
              Upload Avatar
            </Button>
          </div>

          <div className="flex justify-end border-t border-border pt-4">
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Profile Information</CardTitle>
          <CardDescription>Update your account details and preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself"
              rows={3}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={isUpdating}>
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Preferences</CardTitle>
          <CardDescription>Customize your experience and default settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              <Clock className="mr-1 inline h-3.5 w-3.5" />
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              {timezones.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              <Languages className="mr-1 inline h-3.5 w-3.5" />
              Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              {languages.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              <Monitor className="mr-1 inline h-3.5 w-3.5" />
              Default Device for Missions
            </label>
            <select
              value={defaultDevice}
              onChange={(e) => setDefaultDevice(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="">No default (ask every time)</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} - {device.platform}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handlePreferencesSave} disabled={isUpdating}>
              {isUpdating ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Data & Privacy</CardTitle>
          <CardDescription>Manage your data and privacy settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Export My Data</p>
              <p className="text-xs text-muted-foreground">Download all your data in JSON format</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Analytics & Usage Data</p>
              <p className="text-xs text-muted-foreground">Help improve the product by sharing usage data</p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Marketing Communications</p>
              <p className="text-xs text-muted-foreground">Receive updates about new features and tips</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/50 bg-card">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible account actions</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Delete Account</p>
            <p className="text-xs text-muted-foreground">Permanently delete your account and all data</p>
          </div>
          <Button variant="destructive" size="sm" className="w-full sm:w-auto" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Account
          </Button>
        </CardContent>
      </Card>

      {showExportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-semibold text-foreground">Export Your Data</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              This will download all your data including profile, missions, devices, and settings in JSON format.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowExportDialog(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleExportData} className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-destructive/50 bg-card p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-semibold text-destructive">Delete Account</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="flex-1">
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteAccount} className="flex-1">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Forever
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationSettings() {
  const { settings, updateSettings, isUpdating } = useSettings()
  const { toast } = useToast()

  if (!settings) {
    return <div className="text-sm text-muted-foreground">Loading settings...</div>
  }

  const handleToggle = async (key: keyof typeof settings.notifications, value: boolean) => {
    try {
      await updateSettings({
        notifications: {
          ...settings.notifications,
          [key]: value,
        },
      })
      toast({
        title: "Settings updated",
        description: "Your notification preferences have been saved.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Notification Channels</CardTitle>
          <CardDescription>Choose how you want to receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Email Notifications</p>
              <p className="text-xs text-muted-foreground">Receive updates via email</p>
            </div>
            <Switch
              checked={settings.notifications.email}
              onCheckedChange={(value) => handleToggle("email", value)}
              disabled={isUpdating}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Push Notifications</p>
              <p className="text-xs text-muted-foreground">Browser and mobile push alerts</p>
            </div>
            <Switch
              checked={settings.notifications.push}
              onCheckedChange={(value) => handleToggle("push", value)}
              disabled={isUpdating}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Notification Types</CardTitle>
          <CardDescription>Select which events trigger notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Mission Completed</p>
              <p className="text-xs text-muted-foreground">When a mission finishes successfully</p>
            </div>
            <Switch
              checked={settings.notifications.missionComplete}
              onCheckedChange={(value) => handleToggle("missionComplete", value)}
              disabled={isUpdating}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Mission Failed</p>
              <p className="text-xs text-muted-foreground">When a mission encounters an error</p>
            </div>
            <Switch
              checked={settings.notifications.missionFailed}
              onCheckedChange={(value) => handleToggle("missionFailed", value)}
              disabled={isUpdating}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Approval Required</p>
              <p className="text-xs text-muted-foreground">When agent needs your decision</p>
            </div>
            <Switch
              checked={settings.notifications.approvalRequired}
              onCheckedChange={(value) => handleToggle("approvalRequired", value)}
              disabled={isUpdating}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Automation Failed</p>
              <p className="text-xs text-muted-foreground">When an automation encounters an error</p>
            </div>
            <Switch
              checked={settings.notifications.automationFailed}
              onCheckedChange={(value) => handleToggle("automationFailed", value)}
              disabled={isUpdating}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function DeviceSettings() {
  const devices = [
    { name: "MacBook Pro", type: "Desktop Agent", lastActive: "Currently active", status: "connected" },
    { name: "Pixel 7", type: "Android (WebUSB)", lastActive: "2 hours ago", status: "connected" },
    { name: "Windows Workstation", type: "Desktop Agent", lastActive: "3 days ago", status: "disconnected" },
  ]

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Connected Devices</CardTitle>
          <CardDescription>Devices the agent can control for autonomous tasks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {devices.map((device, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  {device.type === "Desktop Agent" ? (
                    <Laptop className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{device.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {device.type} • {device.lastActive}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    device.status === "connected" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {device.status === "connected" ? "Connected" : "Disconnected"}
                </span>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-dashed border-border bg-card">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Monitor className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="mb-1 text-sm font-medium text-foreground">Add New Device</p>
          <p className="mb-4 text-center text-xs text-muted-foreground">
            Connect another device for the agent to control
          </p>
          <Button variant="outline" size="sm">
            <Globe className="mr-2 h-4 w-4" />
            Connect Device
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function SecuritySettings() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const { toast } = useToast()
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [apiKeys, setApiKeys] = useState<Array<{
    keyHash: string
    name: string
    createdAt: string
    lastUsedAt: string | null
  }>>([])
  const [newKeyName, setNewKeyName] = useState("")
  const [newKey, setNewKey] = useState<string | null>(null)
  const [isCreatingKey, setIsCreatingKey] = useState(false)
  const [isLoadingKeys, setIsLoadingKeys] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchApiKeys()
    if (user?.twoFactorEnabled !== undefined) {
      setTwoFactorEnabled(user.twoFactorEnabled)
    }
  }, [user])

  const fetchApiKeys = async () => {
    try {
      const response = await fetch('/api/api-keys')
      if (response.ok) {
        const data = await response.json()
        setApiKeys(data.keys || [])
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error)
    } finally {
      setIsLoadingKeys(false)
    }
  }

  const createApiKey = async () => {
    if (!newKeyName.trim()) return
    setIsCreatingKey(true)
    try {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      })
      if (response.ok) {
        const data = await response.json()
        setNewKey(data.key)
        setNewKeyName("")
        fetchApiKeys()
        toast({
          title: "API key created",
          description: "Your new API key has been created successfully.",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create API key. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsCreatingKey(false)
    }
  }

  const revokeApiKey = async (keyHash: string) => {
    try {
      const response = await fetch(`/api/api-keys/${keyHash}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        fetchApiKeys()
        toast({
          title: "API key revoked",
          description: "The API key has been revoked successfully.",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to revoke API key. Please try again.",
        variant: "destructive",
      })
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleChangePassword = () => {
    window.location.href = '/user-profile'
  }

  const handleSignOutOtherSessions = async () => {
    try {
      await signOut({ sessionId: 'all' })
      toast({
        title: "Sessions signed out",
        description: "All other sessions have been signed out successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out other sessions.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Password & Authentication</CardTitle>
          <CardDescription>Manage your password through Clerk</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Change Password</p>
              <p className="text-xs text-muted-foreground">Update your password for better security</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleChangePassword}>
              <Key className="mr-2 h-4 w-4" />
              Change
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Two-Factor Authentication</CardTitle>
          <CardDescription>Add an extra layer of security to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <Shield className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {twoFactorEnabled ? "2FA Enabled" : "2FA Disabled"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {twoFactorEnabled 
                    ? "Your account is protected with 2FA" 
                    : "Use an app like Google Authenticator"}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleChangePassword}>
              Manage
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Active Sessions</CardTitle>
          <CardDescription>Manage your active sessions across devices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Current Session</p>
                <p className="text-xs text-muted-foreground">This device - Active now</p>
              </div>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Current
              </span>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={handleSignOutOtherSessions}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out All Other Sessions
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">API Keys</CardTitle>
          <CardDescription>Create and manage API keys for programmatic access</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {newKey && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="mb-2 text-sm font-medium text-primary">New API Key Created</p>
              <p className="mb-2 text-xs text-muted-foreground">Copy this key now - you won&apos;t see it again!</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-secondary px-3 py-2 font-mono text-xs text-foreground">{newKey}</code>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(newKey)}>
                  {copied ? <Check className="h-4 w-4" /> : "Copy"}
                </Button>
              </div>
              <Button size="sm" variant="ghost" className="mt-2" onClick={() => setNewKey(null)}>Dismiss</Button>
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Key name (e.g. CLI, Mobile App)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <Button onClick={createApiKey} disabled={isCreatingKey || !newKeyName.trim()}>
              {isCreatingKey ? "Creating..." : "Create Key"}
            </Button>
          </div>

          {isLoadingKeys ? (
            <p className="text-sm text-muted-foreground">Loading keys...</p>
          ) : apiKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API keys yet. Create one to get started.</p>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((key) => (
                <div key={key.keyHash} className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{key.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(key.createdAt).toLocaleDateString()}
                      {key.lastUsedAt && ` • Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => revokeApiKey(key.keyHash)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


const accentColors = [
  { name: "green", value: "#00ff88", cssValue: "oklch(0.85 0.2 155)" },
  { name: "blue", value: "#3b82f6", cssValue: "oklch(0.6 0.2 250)" },
  { name: "purple", value: "#a855f7", cssValue: "oklch(0.65 0.25 295)" },
  { name: "orange", value: "#f59e0b", cssValue: "oklch(0.8 0.15 85)" },
  { name: "red", value: "#ef4444", cssValue: "oklch(0.55 0.22 25)" },
]

function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  const { settings, updateSettings } = useSettings()
  const { toast } = useToast()
  const [mounted, setMounted] = useState(false)
  const [accentColor, setAccentColor] = useState("#00ff88")

  useEffect(() => {
    setMounted(true)
    if (settings?.accentColor) {
      setAccentColor(settings.accentColor)
      applyAccentColor(settings.accentColor)
    } else {
      const savedAccent = localStorage.getItem("controlai-accent-color")
      if (savedAccent) {
        setAccentColor(savedAccent)
        applyAccentColor(savedAccent)
      }
    }
  }, [settings?.accentColor])

  const applyAccentColor = (hexColor: string) => {
    const colorConfig = accentColors.find((c) => c.value === hexColor)
    if (colorConfig) {
      document.documentElement.style.setProperty("--primary", colorConfig.cssValue)
      document.documentElement.style.setProperty("--ring", colorConfig.cssValue)
      document.documentElement.style.setProperty("--sidebar-primary", colorConfig.cssValue)
      document.documentElement.style.setProperty("--sidebar-ring", colorConfig.cssValue)
    }
  }

  const handleAccentChange = async (color: string) => {
    setAccentColor(color)
    applyAccentColor(color)
    localStorage.setItem("controlai-accent-color", color)

    try {
      await updateSettings({ accentColor: color })
      toast({
        title: "Accent color updated",
        description: "Your new color has been saved.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save accent color.",
        variant: "destructive",
      })
    }
  }

  const handleThemeChange = async (newTheme: typeof theme) => {
    if (!newTheme) return
    setTheme(newTheme)
    try {
      await updateSettings({ theme: newTheme as "light" | "dark" | "system" })
      toast({
        title: "Theme updated",
        description: `Switched to ${newTheme} theme.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save theme preference.",
        variant: "destructive",
      })
    }
  }

  if (!mounted) {
    return (
      <div className="space-y-4">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Theme</CardTitle>
            <CardDescription>Choose your preferred color scheme</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-secondary" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Theme</CardTitle>
          <CardDescription>Choose your preferred color scheme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {(["dark", "light", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleThemeChange(t)}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors sm:p-4",
                  theme === t ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground",
                )}
              >
                <div
                  className={cn(
                    "h-10 w-10 rounded-lg sm:h-12 sm:w-12",
                    t === "dark"
                      ? "bg-zinc-900"
                      : t === "light"
                        ? "bg-zinc-100"
                        : "bg-gradient-to-br from-zinc-100 to-zinc-900",
                  )}
                />
                <span className="text-xs font-medium capitalize text-foreground sm:text-sm">{t}</span>
                {theme === t && (
                  <div className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary sm:right-2 sm:top-2 sm:h-5 sm:w-5">
                    <Check className="h-2.5 w-2.5 text-primary-foreground sm:h-3 sm:w-3" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Accent Color</CardTitle>
          <CardDescription>Customize the primary accent color</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {accentColors.map((color) => (
              <button
                key={color.value}
                onClick={() => handleAccentChange(color.value)}
                className={cn(
                  "h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all",
                  accentColor === color.value ? "ring-foreground" : "ring-transparent hover:ring-muted-foreground",
                )}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function BillingSettings() {
  return (
    <div className="space-y-4">
      <Card className="border-primary/50 bg-card">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Pro Plan</CardTitle>
              <CardDescription>Your current subscription</CardDescription>
            </div>
            <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Active</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-baseline gap-1">
            <span className="text-3xl font-bold text-foreground">$49</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <ul className="mb-4 space-y-2">
            <li className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-primary" />
              Unlimited missions
            </li>
            <li className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-primary" />
              Up to 10 connected devices
            </li>
            <li className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-primary" />
              Priority support
            </li>
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="bg-transparent">
              Change Plan
            </Button>
            <Button variant="ghost" className="text-muted-foreground">
              Cancel Subscription
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Payment Method</CardTitle>
          <CardDescription>Manage your billing information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">•••• •••• •••• 4242</p>
                <p className="text-xs text-muted-foreground">Expires 12/25</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              Update
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Billing History</CardTitle>
          <CardDescription>Download past invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { date: "Dec 1, 2024", amount: "$49.00" },
            { date: "Nov 1, 2024", amount: "$49.00" },
            { date: "Oct 1, 2024", amount: "$49.00" },
          ].map((invoice, index) => (
            <div key={index} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{invoice.date}</p>
                <p className="text-xs text-muted-foreground">{invoice.amount}</p>
              </div>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                Download
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
