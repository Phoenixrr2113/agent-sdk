import { z } from 'zod';

export const DevicePlatformSchema = z.enum(['desktop', 'android', 'ios', 'web']);

export type DevicePlatform = z.infer<typeof DevicePlatformSchema>;

export const DeviceActionTypeSchema = z.enum([
  'tap',
  'double_tap',
  'long_press',
  'type',
  'key',
  'swipe',
  'scroll',
  'drag',
  'screenshot',
  'get_ui_tree',
]);

export type DeviceActionType = z.infer<typeof DeviceActionTypeSchema>;

export const TapPayloadSchema = z.object({
  x: z.number(),
  y: z.number(),
  elementId: z.string().optional(),
});

export type TapPayload = z.infer<typeof TapPayloadSchema>;

export const TypePayloadSchema = z.object({
  text: z.string(),
  elementId: z.string().optional(),
});

export type TypePayload = z.infer<typeof TypePayloadSchema>;

export const KeyPayloadSchema = z.object({
  key: z.string(),
  modifiers: z.array(z.enum(['ctrl', 'alt', 'shift', 'meta'])).optional(),
});

export type KeyPayload = z.infer<typeof KeyPayloadSchema>;

export const SwipePayloadSchema = z.object({
  fromX: z.number(),
  fromY: z.number(),
  toX: z.number(),
  toY: z.number(),
  durationMs: z.number().optional(),
});

export type SwipePayload = z.infer<typeof SwipePayloadSchema>;

export const ScrollPayloadSchema = z.object({
  deltaX: z.number(),
  deltaY: z.number(),
  x: z.number().optional(),
  y: z.number().optional(),
});

export type ScrollPayload = z.infer<typeof ScrollPayloadSchema>;

export const DragPayloadSchema = z.object({
  fromX: z.number(),
  fromY: z.number(),
  toX: z.number(),
  toY: z.number(),
});

export type DragPayload = z.infer<typeof DragPayloadSchema>;

export const ScreenshotPayloadSchema = z.object({
  format: z.enum(['png', 'jpeg']).optional(),
  quality: z.number().min(0).max(100).optional(),
});

export type ScreenshotPayload = z.infer<typeof ScreenshotPayloadSchema>;

export const UITreePayloadSchema = z.object({
  depth: z.number().optional(),
  includeInvisible: z.boolean().optional(),
});

export type UITreePayload = z.infer<typeof UITreePayloadSchema>;

export const DeviceActionSchema = z.object({
  type: DeviceActionTypeSchema,
  payload: z.record(z.string(), z.unknown()),
});

export type DeviceAction = z.infer<typeof DeviceActionSchema>;

export const ScreenSizeSchema = z.object({
  width: z.number(),
  height: z.number(),
});

export type ScreenSize = z.infer<typeof ScreenSizeSchema>;

export const DeviceCapabilitiesSchema = z.object({
  platform: DevicePlatformSchema,
  deviceId: z.string(),
  deviceName: z.string(),
  screenSize: ScreenSizeSchema,
  supportedActions: z.array(DeviceActionTypeSchema),
  hasKeyboard: z.boolean(),
  hasUITree: z.boolean(),
});

export type DeviceCapabilities = z.infer<typeof DeviceCapabilitiesSchema>;

export const ActionErrorCodeSchema = z.enum([
  'NOT_SUPPORTED',
  'PERMISSION_DENIED',
  'ELEMENT_NOT_FOUND',
  'TIMEOUT',
  'NOT_FOUND',
  'UNKNOWN',
]);

export type ActionErrorCode = z.infer<typeof ActionErrorCodeSchema>;

export const BoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export type Bounds = z.infer<typeof BoundsSchema>;

export const UIElementTypeSchema = z.enum([
  'button',
  'text',
  'input',
  'image',
  'container',
  'unknown',
]);

export type UIElementType = z.infer<typeof UIElementTypeSchema>;

type UIElementInput = {
  id: string;
  type: UIElementType;
  bounds: Bounds;
  text?: string;
  contentDescription?: string;
  clickable: boolean;
  focusable: boolean;
  enabled: boolean;
  visible: boolean;
  children: UIElementInput[];
};

export const UIElementSchema: z.ZodType<UIElementInput> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: UIElementTypeSchema,
    bounds: BoundsSchema,
    text: z.string().optional(),
    contentDescription: z.string().optional(),
    clickable: z.boolean(),
    focusable: z.boolean(),
    enabled: z.boolean(),
    visible: z.boolean(),
    children: z.array(UIElementSchema),
  })
);

export type UIElement = z.infer<typeof UIElementSchema>;

export const UITreeDataSchema = z.object({
  type: z.literal('ui_tree'),
  root: UIElementSchema,
});

export type UITreeData = z.infer<typeof UITreeDataSchema>;

export const ScreenshotDataSchema = z.object({
  type: z.literal('screenshot'),
  base64: z.string(),
  format: z.enum(['png', 'jpeg']),
  width: z.number(),
  height: z.number(),
});

export type ScreenshotData = z.infer<typeof ScreenshotDataSchema>;

export const ActionResultSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    data: z.union([ScreenshotDataSchema, UITreeDataSchema, z.string()]).optional(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
    code: ActionErrorCodeSchema,
  }),
]);

export type ActionResult = z.infer<typeof ActionResultSchema>;

export const ConnectionStatusSchema = z.enum([
  'connected',
  'disconnected',
  'connecting',
  'error',
]);

export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;

export const DeviceConnectionSchema = z.object({
  deviceId: z.string(),
  userId: z.string(),
  status: ConnectionStatusSchema,
  capabilities: DeviceCapabilitiesSchema.optional(),
  lastSeenAt: z.string(),
  connectedAt: z.string().optional(),
  error: z.string().optional(),
});

export type DeviceConnection = z.infer<typeof DeviceConnectionSchema>;

export const DeviceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  platform: DevicePlatformSchema,
  connection: DeviceConnectionSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Device = z.infer<typeof DeviceSchema>;

export const DeviceEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('device.connected'),
    deviceId: z.string(),
    userId: z.string(),
    capabilities: DeviceCapabilitiesSchema,
  }),
  z.object({
    type: z.literal('device.disconnected'),
    deviceId: z.string(),
    userId: z.string(),
    reason: z.string().optional(),
  }),
  z.object({
    type: z.literal('device.action_requested'),
    deviceId: z.string(),
    action: DeviceActionSchema,
    requestId: z.string(),
  }),
  z.object({
    type: z.literal('device.action_completed'),
    deviceId: z.string(),
    requestId: z.string(),
    result: ActionResultSchema,
  }),
]);

export type DeviceEvent = z.infer<typeof DeviceEventSchema>;
