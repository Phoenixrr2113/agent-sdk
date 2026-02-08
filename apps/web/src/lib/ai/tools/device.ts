import { tool } from 'ai';
import { z } from 'zod';

import type { DeviceRegistry } from '../../devices/registry';
import type { DeviceAction, ActionResult } from '../../types/device';

type DeviceToolDependencies = {
  registry: DeviceRegistry;
};

const deviceActionParamsSchema = z.object({
  deviceId: z.string().describe('The ID of the connected device'),
  actionType: z
    .enum([
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
    ])
    .describe('The type of action to perform'),
  x: z.number().optional().describe('X coordinate for tap/click actions'),
  y: z.number().optional().describe('Y coordinate for tap/click actions'),
  text: z.string().optional().describe('Text to type or key to press'),
  modifiers: z
    .array(z.enum(['ctrl', 'alt', 'shift', 'meta']))
    .optional()
    .describe('Modifier keys for key actions'),
  fromX: z.number().optional().describe('Start X for swipe/drag'),
  fromY: z.number().optional().describe('Start Y for swipe/drag'),
  toX: z.number().optional().describe('End X for swipe/drag'),
  toY: z.number().optional().describe('End Y for swipe/drag'),
  deltaX: z.number().optional().describe('Horizontal scroll amount'),
  deltaY: z.number().optional().describe('Vertical scroll amount'),
  durationMs: z.number().optional().describe('Duration for swipe action in milliseconds'),
  elementId: z.string().optional().describe('CSS selector or element ID for web actions'),
});

type DeviceActionParams = z.infer<typeof deviceActionParamsSchema>;

const deviceIdSchema = z.object({
  deviceId: z.string().describe('The ID of the connected device'),
});

type DeviceIdParams = z.infer<typeof deviceIdSchema>;

const userIdSchema = z.object({
  userId: z.string().describe('The user ID to list devices for'),
});

type UserIdParams = z.infer<typeof userIdSchema>;

export function createDeviceTools(deps: DeviceToolDependencies) {
  const { registry } = deps;

  const deviceAction = tool({
    description:
      'Execute an action on a connected device. Supports tap, type, key, scroll, swipe, drag, and other device interactions.',
    inputSchema: deviceActionParamsSchema,
    execute: async (params) => {
      const device = registry.getDevice(params.deviceId);
      if (!device) {
        return {
          success: false as const,
          error: 'Device not found',
          code: 'NOT_FOUND' as const,
        };
      }

      if (!registry.isConnected(params.deviceId)) {
        return {
          success: false as const,
          error: 'Device not connected',
          code: 'UNKNOWN' as const,
        };
      }

      const action = buildAction(params);
      return device.driver.execute(action);
    },
  });

  const deviceScreenshot = tool({
    description: 'Capture a screenshot from a connected device.',
    inputSchema: deviceIdSchema,
    execute: async ({ deviceId }) => {
      const device = registry.getDevice(deviceId);
      if (!device) {
        return {
          success: false as const,
          error: 'Device not found',
          code: 'NOT_FOUND' as const,
        };
      }

      if (!registry.isConnected(deviceId)) {
        return {
          success: false as const,
          error: 'Device not connected',
          code: 'UNKNOWN' as const,
        };
      }

      return device.driver.execute({
        type: 'screenshot',
        payload: { format: 'png' },
      });
    },
  });

  const deviceUITree = tool({
    description:
      'Get the UI element tree from a connected device. Returns a hierarchical structure of visible UI elements with their positions and properties.',
    inputSchema: deviceIdSchema,
    execute: async ({ deviceId }) => {
      const device = registry.getDevice(deviceId);
      if (!device) {
        return {
          success: false as const,
          error: 'Device not found',
          code: 'NOT_FOUND' as const,
        };
      }

      if (!registry.isConnected(deviceId)) {
        return {
          success: false as const,
          error: 'Device not connected',
          code: 'UNKNOWN' as const,
        };
      }

      const capabilities = await device.driver.getCapabilities();
      if (!capabilities.hasUITree) {
        return {
          success: false as const,
          error: 'Device does not support UI tree extraction',
          code: 'NOT_SUPPORTED' as const,
        };
      }

      return device.driver.execute({
        type: 'get_ui_tree',
        payload: {},
      });
    },
  });

  const listDevices = tool({
    description: 'List all connected devices for a user.',
    inputSchema: userIdSchema,
    execute: async ({ userId }) => {
      const devices = registry.getDevicesByUser(userId);

      return {
        success: true,
        devices: devices.map((d) => ({
          deviceId: d.connection.deviceId,
          status: d.connection.status,
          platform: d.connection.capabilities?.platform,
          deviceName: d.connection.capabilities?.deviceName,
          lastSeenAt: d.connection.lastSeenAt,
        })),
      };
    },
  });

  return {
    device_action: deviceAction,
    device_screenshot: deviceScreenshot,
    device_ui_tree: deviceUITree,
    list_devices: listDevices,
  };
}

function buildAction(params: {
  actionType: string;
  x?: number;
  y?: number;
  text?: string;
  modifiers?: string[];
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  deltaX?: number;
  deltaY?: number;
  durationMs?: number;
  elementId?: string;
}): DeviceAction {
  const { actionType } = params;

  switch (actionType) {
    case 'tap':
    case 'double_tap':
    case 'long_press':
      return {
        type: actionType,
        payload: {
          x: params.x ?? 0,
          y: params.y ?? 0,
          elementId: params.elementId,
        },
      };

    case 'type':
      return {
        type: 'type',
        payload: {
          text: params.text ?? '',
          elementId: params.elementId,
        },
      };

    case 'key':
      return {
        type: 'key',
        payload: {
          key: params.text ?? '',
          modifiers: params.modifiers,
        },
      };

    case 'swipe':
      return {
        type: 'swipe',
        payload: {
          fromX: params.fromX ?? 0,
          fromY: params.fromY ?? 0,
          toX: params.toX ?? 0,
          toY: params.toY ?? 0,
          durationMs: params.durationMs,
        },
      };

    case 'scroll':
      return {
        type: 'scroll',
        payload: {
          deltaX: params.deltaX ?? 0,
          deltaY: params.deltaY ?? 0,
          x: params.x,
          y: params.y,
        },
      };

    case 'drag':
      return {
        type: 'drag',
        payload: {
          fromX: params.fromX ?? 0,
          fromY: params.fromY ?? 0,
          toX: params.toX ?? 0,
          toY: params.toY ?? 0,
        },
      };

    case 'screenshot':
      return {
        type: 'screenshot',
        payload: { format: 'png' },
      };

    case 'get_ui_tree':
      return {
        type: 'get_ui_tree',
        payload: {},
      };

    default:
      return {
        type: actionType as DeviceAction['type'],
        payload: {},
      };
  }
}
