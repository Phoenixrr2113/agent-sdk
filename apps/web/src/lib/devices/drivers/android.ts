import type {
  DeviceAction,
  ActionResult,
  DeviceCapabilities,
  TapPayload,
  TypePayload,
  KeyPayload,
  SwipePayload,
  ScrollPayload,
  DragPayload,
  UIElement,
} from '../../types/device';
import type { DeviceDriver } from '../driver';

type MobileAccessibility = {
  click(x: number, y: number): Promise<boolean>;
  longPress(x: number, y: number, duration: number): Promise<boolean>;
  type(text: string): Promise<boolean>;
  pressKey(key: string): Promise<boolean>;
  swipe(fromX: number, fromY: number, toX: number, toY: number, duration: number): Promise<boolean>;
  screenshot(): Promise<string | null>;
  getUITree(): Promise<string | null>;
};

let mobileAccessibility: MobileAccessibility | null = null;

async function loadMobileAccessibility(): Promise<MobileAccessibility> {
  if (!mobileAccessibility) {
    try {
      const mod = await import('@agent/mobile-accessibility');
      mobileAccessibility = mod as unknown as MobileAccessibility;
    } catch {
      throw new Error('@agent/mobile-accessibility not available. This driver requires the mobile accessibility module.');
    }
  }
  return mobileAccessibility;
}

export type AndroidDriverOptions = {
  screenWidth?: number;
  screenHeight?: number;
};

export function createAndroidDriver(options: AndroidDriverOptions = {}): DeviceDriver {
  let screenSize = {
    width: options.screenWidth ?? 1080,
    height: options.screenHeight ?? 1920,
  };

  async function handleTap(accessibility: MobileAccessibility, payload: TapPayload): Promise<ActionResult> {
    const success = await accessibility.click(payload.x, payload.y);
    return success
      ? { success: true }
      : { success: false, error: 'Tap failed', code: 'UNKNOWN' };
  }

  async function handleDoubleTap(accessibility: MobileAccessibility, payload: TapPayload): Promise<ActionResult> {
    await accessibility.click(payload.x, payload.y);
    await accessibility.click(payload.x, payload.y);
    return { success: true };
  }

  async function handleLongPress(accessibility: MobileAccessibility, payload: TapPayload): Promise<ActionResult> {
    const success = await accessibility.longPress(payload.x, payload.y, 500);
    return success
      ? { success: true }
      : { success: false, error: 'Long press failed', code: 'UNKNOWN' };
  }

  async function handleType(accessibility: MobileAccessibility, payload: TypePayload): Promise<ActionResult> {
    const success = await accessibility.type(payload.text);
    return success
      ? { success: true }
      : { success: false, error: 'Type failed', code: 'UNKNOWN' };
  }

  async function handleKey(accessibility: MobileAccessibility, payload: KeyPayload): Promise<ActionResult> {
    const success = await accessibility.pressKey(payload.key);
    return success
      ? { success: true }
      : { success: false, error: 'Key press failed', code: 'UNKNOWN' };
  }

  async function handleSwipe(accessibility: MobileAccessibility, payload: SwipePayload): Promise<ActionResult> {
    const duration = payload.durationMs ?? 300;
    const success = await accessibility.swipe(
      payload.fromX,
      payload.fromY,
      payload.toX,
      payload.toY,
      duration
    );
    return success
      ? { success: true }
      : { success: false, error: 'Swipe failed', code: 'UNKNOWN' };
  }

  async function handleScroll(accessibility: MobileAccessibility, payload: ScrollPayload): Promise<ActionResult> {
    const cx = payload.x ?? screenSize.width / 2;
    const cy = payload.y ?? screenSize.height / 2;
    const toY = cy - payload.deltaY;
    const toX = cx - payload.deltaX;
    await accessibility.swipe(cx, cy, toX, toY, 300);
    return { success: true };
  }

  async function handleDrag(accessibility: MobileAccessibility, payload: DragPayload): Promise<ActionResult> {
    await accessibility.swipe(payload.fromX, payload.fromY, payload.toX, payload.toY, 500);
    return { success: true };
  }

  async function handleScreenshot(accessibility: MobileAccessibility): Promise<ActionResult> {
    const base64 = await accessibility.screenshot();
    if (!base64) {
      return { success: false, error: 'Screenshot failed', code: 'UNKNOWN' };
    }
    return {
      success: true,
      data: {
        type: 'screenshot',
        base64,
        format: 'png',
        width: screenSize.width,
        height: screenSize.height,
      },
    };
  }

  async function handleGetUITree(accessibility: MobileAccessibility): Promise<ActionResult> {
    const treeJson = await accessibility.getUITree();
    if (!treeJson) {
      return { success: false, error: 'UI tree failed', code: 'UNKNOWN' };
    }
    return {
      success: true,
      data: {
        type: 'ui_tree',
        root: JSON.parse(treeJson) as UIElement,
      },
    };
  }

  return {
    async execute(action: DeviceAction): Promise<ActionResult> {
      const accessibility = await loadMobileAccessibility();

      try {
        switch (action.type) {
          case 'tap':
            return await handleTap(accessibility, action.payload as TapPayload);
          case 'double_tap':
            return await handleDoubleTap(accessibility, action.payload as TapPayload);
          case 'long_press':
            return await handleLongPress(accessibility, action.payload as TapPayload);
          case 'type':
            return await handleType(accessibility, action.payload as TypePayload);
          case 'key':
            return await handleKey(accessibility, action.payload as KeyPayload);
          case 'swipe':
            return await handleSwipe(accessibility, action.payload as SwipePayload);
          case 'scroll':
            return await handleScroll(accessibility, action.payload as ScrollPayload);
          case 'drag':
            return await handleDrag(accessibility, action.payload as DragPayload);
          case 'screenshot':
            return await handleScreenshot(accessibility);
          case 'get_ui_tree':
            return await handleGetUITree(accessibility);
          default:
            return { success: false, error: `Unknown action type: ${action.type}`, code: 'NOT_SUPPORTED' };
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'UNKNOWN',
        };
      }
    },

    async getCapabilities(): Promise<DeviceCapabilities> {
      return {
        platform: 'android',
        deviceId: 'android-device',
        deviceName: 'Android Device',
        screenSize,
        supportedActions: [
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
        ],
        hasKeyboard: true,
        hasUITree: true,
      };
    },

    async getUITree(): Promise<UIElement> {
      const accessibility = await loadMobileAccessibility();
      const treeJson = await accessibility.getUITree();
      if (!treeJson) {
        throw new Error('UI tree not available');
      }
      return JSON.parse(treeJson) as UIElement;
    },
  };
}
