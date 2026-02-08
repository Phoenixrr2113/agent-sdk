"use client"

import { useEffect } from "react"
import { X, Command, Hash, Slash, CornerDownLeft, Keyboard } from "lucide-react"

interface KeyboardShortcutsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ShortcutItem {
  keys: string[]
  description: string
  icon?: React.ComponentType<{ className?: string }>
}

interface ShortcutCategory {
  title: string
  shortcuts: ShortcutItem[]
}

const isMac = typeof window !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0

const shortcutCategories: ShortcutCategory[] = [
  {
    title: "Navigation",
    shortcuts: [
      {
        keys: [isMac ? "⌘" : "Ctrl", "K"],
        description: "Open command palette",
        icon: Command,
      },
      {
        keys: ["G", "D"],
        description: "Go to Dashboard",
      },
      {
        keys: ["G", "C"],
        description: "Go to Chat",
      },
      {
        keys: ["G", "M"],
        description: "Go to Missions",
      },
      {
        keys: ["G", "A"],
        description: "Go to Automations",
      },
      {
        keys: ["G", "V"],
        description: "Go to Vault",
      },
      {
        keys: ["G", "S"],
        description: "Go to Settings",
      },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      {
        keys: ["N"],
        description: "New mission",
        icon: Hash,
      },
      {
        keys: ["/"],
        description: "Focus search",
        icon: Slash,
      },
      {
        keys: ["Esc"],
        description: "Close modals",
      },
      {
        keys: ["?"],
        description: "Show keyboard shortcuts",
        icon: Keyboard,
      },
    ],
  },
  {
    title: "Chat",
    shortcuts: [
      {
        keys: ["Enter"],
        description: "Send message",
        icon: CornerDownLeft,
      },
      {
        keys: ["Shift", "Enter"],
        description: "New line in message",
      },
    ],
  },
]

function KeyboardKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 text-xs font-medium text-muted-foreground shadow-sm">
      {children}
    </kbd>
  )
}

export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const target = e.target as HTMLElement
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return
        }
        e.preventDefault()
        onOpenChange(true)
      }
      if (e.key === "Escape" && open) {
        onOpenChange(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onOpenChange])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 p-4">
        <div className="rounded-xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Keyboard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Keyboard Shortcuts</h2>
                <p className="text-sm text-muted-foreground">Quick access to all features</p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-4 sm:p-6">
            <div className="space-y-6">
              {shortcutCategories.map((category) => (
                <div key={category.title}>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {category.title}
                  </h3>
                  <div className="space-y-2">
                    {category.shortcuts.map((shortcut, index) => {
                      const Icon = shortcut.icon
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-secondary/50"
                        >
                          <div className="flex items-center gap-3">
                            {Icon && (
                              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <span className="text-sm text-foreground">{shortcut.description}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {shortcut.keys.map((key, keyIndex) => (
                              <span key={keyIndex} className="flex items-center gap-1">
                                <KeyboardKey>{key}</KeyboardKey>
                                {keyIndex < shortcut.keys.length - 1 && (
                                  <span className="text-xs text-muted-foreground">+</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border bg-muted/30 px-4 py-3 sm:px-6">
            <p className="text-center text-xs text-muted-foreground">
              Press <KeyboardKey>?</KeyboardKey> anytime to view these shortcuts
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
