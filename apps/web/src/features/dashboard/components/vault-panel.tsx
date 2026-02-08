"use client"

import { useState } from "react"
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Check,
  Calendar,
  Shield,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { cn } from "@/libs/utils"
import { useAPIKeys, type APIKeyScope, type CreateAPIKeyResponse } from "@/hooks/use-api-keys"
import { useToast } from "@/hooks/use-toast"

const SCOPE_OPTIONS: { value: APIKeyScope; label: string; description: string }[] = [
  { value: 'full_access', label: 'Full Access', description: 'Complete access to all resources' },
  { value: 'read:missions', label: 'Read Missions', description: 'View mission data' },
  { value: 'write:missions', label: 'Write Missions', description: 'Create and update missions' },
  { value: 'read:automations', label: 'Read Automations', description: 'View automation data' },
  { value: 'write:automations', label: 'Write Automations', description: 'Create and update automations' },
  { value: 'read:devices', label: 'Read Devices', description: 'View device data' },
  { value: 'write:devices', label: 'Write Devices', description: 'Manage devices' },
]

export function VaultPanel() {
  const { apiKeys, isLoading, createKey, revokeKey, isCreating, isRevoking } = useAPIKeys()
  const { toast } = useToast()

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showKeyRevealDialog, setShowKeyRevealDialog] = useState(false)
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null)
  const [newKeyData, setNewKeyData] = useState<CreateAPIKeyResponse | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Form state
  const [keyName, setKeyName] = useState("")
  const [selectedScopes, setSelectedScopes] = useState<Set<APIKeyScope>>(new Set(['full_access']))
  const [expiresAt, setExpiresAt] = useState<string>("")

  const handleCreateKey = async () => {
    if (!keyName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for the API key.",
        variant: "destructive",
      })
      return
    }

    if (selectedScopes.size === 0) {
      toast({
        title: "Error",
        description: "Please select at least one scope.",
        variant: "destructive",
      })
      return
    }

    try {
      const result = await createKey({
        name: keyName,
        scopes: Array.from(selectedScopes),
        expiresAt: expiresAt || null,
      })

      setNewKeyData(result)
      setShowCreateDialog(false)
      setShowKeyRevealDialog(true)

      // Reset form
      setKeyName("")
      setSelectedScopes(new Set(['full_access']))
      setExpiresAt("")

      toast({
        title: "API key created",
        description: "Your new API key has been generated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create API key. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleRevokeKey = async () => {
    if (!selectedKeyId) return

    try {
      await revokeKey(selectedKeyId)
      setShowRevokeDialog(false)
      setSelectedKeyId(null)

      toast({
        title: "API key revoked",
        description: "The API key has been permanently revoked.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to revoke API key. Please try again.",
        variant: "destructive",
      })
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const toggleScope = (scope: APIKeyScope) => {
    const newScopes = new Set(selectedScopes)
    if (scope === 'full_access') {
      // If selecting full_access, deselect all others
      newScopes.clear()
      newScopes.add('full_access')
    } else {
      // Remove full_access if selecting granular scope
      newScopes.delete('full_access')
      if (newScopes.has(scope)) {
        newScopes.delete(scope)
      } else {
        newScopes.add(scope)
      }
      // If no scopes, default to full_access
      if (newScopes.size === 0) {
        newScopes.add('full_access')
      }
    }
    setSelectedScopes(newScopes)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-hidden pt-14 md:pt-0">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">API Keys</h1>
          <p className="text-sm text-muted-foreground">Manage API keys for programmatic access</p>
        </div>
        <Button className="gap-2 shrink-0" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4" />
          Create API Key
        </Button>
      </div>

      {/* API Keys List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading API keys...</p>
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <KeyRound className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">No API keys yet</p>
              <p className="text-sm text-muted-foreground">Create your first API key to get started</p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} className="mt-2">
              <Plus className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {apiKeys.map((key) => (
              <Card key={key.id} className="border-border bg-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-medium text-foreground">{key.name}</h3>
                      </div>
                      
                      <div className="mt-2 flex items-center gap-2">
                        <code className="rounded bg-secondary px-2 py-1 font-mono text-xs text-foreground">
                          {key.keyPrefix}...
                        </code>
                        <button
                          onClick={() => copyToClipboard(key.keyPrefix, key.id)}
                          className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          {copiedId === key.id ? (
                            <Check className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {key.scopes.map((scope) => (
                          <span
                            key={scope}
                            className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Created {formatDate(key.createdAt)}</span>
                        </div>
                        {key.lastUsedAt && (
                          <div className="flex items-center gap-1.5">
                            <span>Last used {formatDate(key.lastUsedAt)}</span>
                          </div>
                        )}
                        {key.expiresAt && (
                          <div className="flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span>Expires {formatDate(key.expiresAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setSelectedKeyId(key.id)
                        setShowRevokeDialog(true)
                      }}
                      disabled={isRevoking}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create API Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Generate a new API key for programmatic access to your account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Name</label>
              <input
                type="text"
                placeholder="e.g., CLI Tool, Mobile App"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Scopes</label>
              <p className="text-xs text-muted-foreground">Select the permissions for this key</p>
              <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-3">
                {SCOPE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md p-2 transition-colors hover:bg-secondary",
                      selectedScopes.has(option.value) && "bg-primary/5",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedScopes.has(option.value)}
                      onChange={() => toggleScope(option.value)}
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Expiration (Optional)</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateKey} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Key Reveal Dialog */}
      <Dialog open={showKeyRevealDialog} onOpenChange={setShowKeyRevealDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Check className="h-5 w-5" />
              API Key Created Successfully
            </DialogTitle>
            <DialogDescription>
              Copy this key now - you won&apos;t be able to see it again!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="mb-2 text-sm font-medium text-foreground">Your API Key</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-secondary px-3 py-2 font-mono text-sm text-foreground break-all">
                  {newKeyData?.key}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => newKeyData?.key && copyToClipboard(newKeyData.key, 'new-key')}
                >
                  {copiedId === 'new-key' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-secondary/50 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Important Security Notice</p>
                  <p>
                    Store this key securely. Anyone with this key can access your account with the granted permissions.
                    If you lose this key, you&apos;ll need to create a new one.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowKeyRevealDialog(false)} className="w-full">
              I&apos;ve Saved My Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Applications using this key will immediately lose access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowRevokeDialog(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeKey}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRevoking ? "Revoking..." : "Revoke Key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
