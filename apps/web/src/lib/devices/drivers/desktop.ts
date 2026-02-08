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
} from '../../types/device';
import type { DeviceDriver } from '../driver';

type NutMouse = {
  setPosition(point: { x: number; y: number }): Promise<void>;
  click(button: number): Promise<void>;
  doubleClick(button: number): Promise<void>;
  pressButton(button: number): Promise<void>;
  releaseButton(button: number): Promise<void>;
  scrollDown(amount: number): Promise<void>;
  scrollUp(amount: number): Promise<void>;
  scrollRight(amount: number): Promise<void>;
  scrollLeft(amount: number): Promise<void>;
  drag(points: Array<{ x: number; y: number }>): Promise<void>;
};

type NutKeyboard = {
  type(text: string): Promise<void>;
  pressKey(key: number): Promise<void>;
  releaseKey(key: number): Promise<void>;
};

type NutScreen = {
  grab(): Promise<{ data: Buffer }>;
  width(): Promise<number>;
  height(): Promise<number>;
};

type NutJS = {
  mouse: NutMouse;
  keyboard: NutKeyboard;
  screen: NutScreen;
  Button: { LEFT: number; RIGHT: number; MIDDLE: number };
  Key: Record<string, number>;
  Point: new (x: number, y: number) => { x: number; y: number };
};

let nutjs: NutJS | null = null;

async function loadNutJS(): Promise<NutJS> {
  if (!nutjs) {
    try {
      const mod = await import('@nut-tree-fork/nut-js');
      nutjs = mod as unknown as NutJS;
    } catch {
      throw new Error('@nut-tree-fork/nut-js not installed. Run: pnpm add @nut-tree-fork/nut-js');
    }
  }
  return nutjs;
}

export type DesktopDriverOptions = {
  platform?: 'macos' | 'linux' | 'windows';
};

export function createDesktopDriver(options: DesktopDriverOptions = {}): DeviceDriver {
  const platform = options.platform ?? detectPlatform();

  function detectPlatform(): 'macos' | 'linux' | 'windows' {
    const p = process.platform;
    if (p === 'darwin') return 'macos';
    if (p === 'win32') return 'windows';
    return 'linux';
  }

  async function handleTap(nut: NutJS, payload: TapPayload): Promise<ActionResult> {
    await nut.mouse.setPosition(new nut.Point(payload.x, payload.y));
    await nut.mouse.click(nut.Button.LEFT);
    return { success: true };
  }

  async function handleDoubleTap(nut: NutJS, payload: TapPayload): Promise<ActionResult> {
    await nut.mouse.setPosition(new nut.Point(payload.x, payload.y));
    await nut.mouse.doubleClick(nut.Button.LEFT);
    return { success: true };
  }

  async function handleLongPress(nut: NutJS, payload: TapPayload): Promise<ActionResult> {
    await nut.mouse.setPosition(new nut.Point(payload.x, payload.y));
    await nut.mouse.pressButton(nut.Button.LEFT);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await nut.mouse.releaseButton(nut.Button.LEFT);
    return { success: true };
  }

  async function handleType(nut: NutJS, payload: TypePayload): Promise<ActionResult> {
    await nut.keyboard.type(payload.text);
    return { success: true };
  }

  async function handleKey(nut: NutJS, payload: KeyPayload): Promise<ActionResult> {
    const keys: number[] = [];

    if (payload.modifiers) {
      for (const mod of payload.modifiers) {
        switch (mod) {
          case 'ctrl':
            keys.push(nut.Key.LeftControl ?? 0);
            break;
          case 'alt':
            keys.push(nut.Key.LeftAlt ?? 0);
            break;
          case 'shift':
            keys.push(nut.Key.LeftShift ?? 0);
            break;
          case 'meta':
            keys.push(nut.Key.LeftSuper ?? 0);
            break;
        }
      }
    }

    keys.push(mapKeyToNutJS(nut, payload.key));

    for (const k of keys) {
      await nut.keyboard.pressKey(k);
    }
    for (const k of keys.reverse()) {
      await nut.keyboard.releaseKey(k);
    }

    return { success: true };
  }

  async function handleSwipe(nut: NutJS, payload: SwipePayload): Promise<ActionResult> {
    await nut.mouse.setPosition(new nut.Point(payload.fromX, payload.fromY));
    await nut.mouse.pressButton(nut.Button.LEFT);
    await nut.mouse.setPosition(new nut.Point(payload.toX, payload.toY));
    await nut.mouse.releaseButton(nut.Button.LEFT);
    return { success: true };
  }

  async function handleScroll(nut: NutJS, payload: ScrollPayload): Promise<ActionResult> {
    if (payload.x !== undefined && payload.y !== undefined) {
      await nut.mouse.setPosition(new nut.Point(payload.x, payload.y));
    }

    if (payload.deltaY > 0) {
      await nut.mouse.scrollDown(Math.abs(payload.deltaY));
    } else if (payload.deltaY < 0) {
      await nut.mouse.scrollUp(Math.abs(payload.deltaY));
    }

    if (payload.deltaX > 0) {
      await nut.mouse.scrollRight(Math.abs(payload.deltaX));
    } else if (payload.deltaX < 0) {
      await nut.mouse.scrollLeft(Math.abs(payload.deltaX));
    }

    return { success: true };
  }

  async function handleDrag(nut: NutJS, payload: DragPayload): Promise<ActionResult> {
    await nut.mouse.setPosition(new nut.Point(payload.fromX, payload.fromY));
    await nut.mouse.drag([new nut.Point(payload.toX, payload.toY)]);
    return { success: true };
  }

  async function handleScreenshot(nut: NutJS): Promise<ActionResult> {
    const image = await nut.screen.grab();
    const base64 = image.data.toString('base64');
    const width = await nut.screen.width();
    const height = await nut.screen.height();
    return {
      success: true,
      data: {
        type: 'screenshot',
        base64,
        format: 'png',
        width,
        height,
      },
    };
  }

  function mapKeyToNutJS(nut: NutJS, key: string): number {
    const keyMap: Record<string, string> = {
      Return: 'Return',
      Enter: 'Return',
      Tab: 'Tab',
      Space: 'Space',
      Escape: 'Escape',
      Esc: 'Escape',
      Delete: 'Delete',
      Backspace: 'Backspace',
      Up: 'Up',
      Down: 'Down',
      Left: 'Left',
      Right: 'Right',
      Home: 'Home',
      End: 'End',
      PageUp: 'PageUp',
      PageDown: 'PageDown',
      F1: 'F1',
      F2: 'F2',
      F3: 'F3',
      F4: 'F4',
      F5: 'F5',
      F6: 'F6',
      F7: 'F7',
      F8: 'F8',
      F9: 'F9',
      F10: 'F10',
      F11: 'F11',
      F12: 'F12',
    };

    const mappedKey = keyMap[key] ?? key;
    return nut.Key[mappedKey] ?? 0;
  }

  return {
    async execute(action: DeviceAction): Promise<ActionResult> {
      const nut = await loadNutJS();

      try {
        switch (action.type) {
          case 'tap':
            return await handleTap(nut, action.payload as TapPayload);
          case 'double_tap':
            return await handleDoubleTap(nut, action.payload as TapPayload);
          case 'long_press':
            return await handleLongPress(nut, action.payload as TapPayload);
          case 'type':
            return await handleType(nut, action.payload as TypePayload);
          case 'key':
            return await handleKey(nut, action.payload as KeyPayload);
          case 'swipe':
            return await handleSwipe(nut, action.payload as SwipePayload);
          case 'scroll':
            return await handleScroll(nut, action.payload as ScrollPayload);
          case 'drag':
            return await handleDrag(nut, action.payload as DragPayload);
          case 'screenshot':
            return await handleScreenshot(nut);
          case 'get_ui_tree':
            return { success: false, error: 'UI tree not supported on desktop', code: 'NOT_SUPPORTED' };
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
      try {
        const nut = await loadNutJS();
        const width = await nut.screen.width();
        const height = await nut.screen.height();

        return {
          platform: 'desktop',
          deviceId: `desktop-${platform}`,
          deviceName: `${platform.charAt(0).toUpperCase()}${platform.slice(1)} Desktop`,
          screenSize: { width, height },
          supportedActions: ['tap', 'double_tap', 'type', 'key', 'scroll', 'drag', 'screenshot'],
          hasKeyboard: true,
          hasUITree: false,
        };
      } catch {
        return {
          platform: 'desktop',
          deviceId: `desktop-${platform}`,
          deviceName: `${platform.charAt(0).toUpperCase()}${platform.slice(1)} Desktop`,
          screenSize: { width: 1920, height: 1080 },
          supportedActions: ['tap', 'double_tap', 'type', 'key', 'scroll', 'drag', 'screenshot'],
          hasKeyboard: true,
          hasUITree: false,
        };
      }
    },
  };
}
