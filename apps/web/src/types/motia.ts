/**
 * Motia Types
 * Type definitions for Motia backend API entities
 */

// Mission Types
export type MissionStatus =
  | 'planning'
  | 'executing'
  | 'awaiting_approval'
  | 'paused'
  | 'completed'
  | 'failed'

export type MissionStepStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped'

export type MissionStep = {
  id: string
  description: string
  status: MissionStepStatus
  requiresApproval: boolean
  result?: string
  error?: string
  startedAt?: string
  completedAt?: string
}

export type MissionPlan = {
  steps: MissionStep[]
  estimatedDuration?: string
  reasoning?: string
}

export type ApprovalSettings = {
  requireForActions?: string[]
  notifyOn?: Array<'progress' | 'completion' | 'approval_needed'>
  autoApproveAfter?: number
}

export type Mission = {
  id: string
  userId: string
  goal: string
  status: MissionStatus
  plan?: MissionPlan
  progress: number
  currentStepId?: string
  approvalSettings?: ApprovalSettings
  error?: string
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export type CreateMissionInput = {
  goal: string
  approvalSettings?: ApprovalSettings
  metadata?: Record<string, unknown>
}

// Automation Types
export type AutomationStatus = 'active' | 'paused' | 'disabled' | 'error'

export type TriggerType = 'cron' | 'event' | 'webhook' | 'manual'

export type CronTrigger = {
  type: 'cron'
  expression: string
  timezone?: string
}

export type EventTrigger = {
  type: 'event'
  eventName: string
  conditions?: Record<string, unknown>
}

export type WebhookTrigger = {
  type: 'webhook'
  path: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  secret?: string
}

export type ManualTrigger = {
  type: 'manual'
}

export type AutomationTrigger =
  | CronTrigger
  | EventTrigger
  | WebhookTrigger
  | ManualTrigger

export type AutomationAction = {
  id: string
  type: string
  config: Record<string, unknown>
  order: number
}

export type RunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type AutomationRun = {
  id: string
  automationId: string
  status: RunStatus
  triggeredBy: TriggerType
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  startedAt: string
  completedAt?: string
  durationMs?: number
}

export type Automation = {
  id: string
  userId: string
  name: string
  description?: string
  status: AutomationStatus
  trigger: AutomationTrigger
  actions: AutomationAction[]
  lastRunAt?: string
  lastRunStatus?: RunStatus
  runCount: number
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type CreateAutomationInput = {
  name: string
  description?: string
  trigger: AutomationTrigger
  actions: AutomationAction[]
  metadata?: Record<string, unknown>
}

// Device Types
export type DevicePlatform = 'desktop' | 'android' | 'ios' | 'web'

export type DeviceActionType =
  | 'tap'
  | 'double_tap'
  | 'long_press'
  | 'type'
  | 'key'
  | 'swipe'
  | 'scroll'
  | 'drag'
  | 'screenshot'
  | 'get_ui_tree'

export type DeviceAction = {
  type: DeviceActionType
  payload: Record<string, unknown>
}

export type ScreenSize = {
  width: number
  height: number
}

export type DeviceCapabilities = {
  platform: DevicePlatform
  deviceId: string
  deviceName: string
  screenSize: ScreenSize
  supportedActions: DeviceActionType[]
  hasKeyboard: boolean
  hasUITree: boolean
}

export type ActionErrorCode =
  | 'NOT_SUPPORTED'
  | 'PERMISSION_DENIED'
  | 'ELEMENT_NOT_FOUND'
  | 'TIMEOUT'
  | 'NOT_FOUND'
  | 'UNKNOWN'

export type Bounds = {
  x: number
  y: number
  width: number
  height: number
}

export type UIElementType =
  | 'button'
  | 'text'
  | 'input'
  | 'image'
  | 'container'
  | 'unknown'

export type UIElement = {
  id: string
  type: UIElementType
  bounds: Bounds
  text?: string
  contentDescription?: string
  clickable: boolean
  focusable: boolean
  enabled: boolean
  visible: boolean
  children: UIElement[]
}

export type UITreeData = {
  type: 'ui_tree'
  root: UIElement
}

export type ScreenshotData = {
  type: 'screenshot'
  base64: string
  format: 'png' | 'jpeg'
  width: number
  height: number
}

export type ActionResult =
  | {
      success: true
      data?: ScreenshotData | UITreeData | string
    }
  | {
      success: false
      error: string
      code: ActionErrorCode
    }

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error'

export type DeviceConnection = {
  deviceId: string
  userId: string
  status: ConnectionStatus
  capabilities?: DeviceCapabilities
  lastSeenAt: string
  connectedAt?: string
  error?: string
}

export type Device = {
  id: string
  userId: string
  name: string
  platform: DevicePlatform
  connection?: DeviceConnection
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}
