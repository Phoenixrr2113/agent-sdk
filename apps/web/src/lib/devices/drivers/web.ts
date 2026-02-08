import type {
  DeviceAction,
  ActionResult,
  DeviceCapabilities,
  TapPayload,
  TypePayload,
  KeyPayload,
  SwipePayload,
  ScrollPayload,
  UIElement,
  ScreenshotData,
} from '../../types/device';
import type { DeviceDriver } from '../driver';

type PlaywrightModule = typeof import('playwright');
type Browser = Awaited<ReturnType<PlaywrightModule['chromium']['launch']>>;
type BrowserContext = Awaited<ReturnType<Browser['newContext']>>;
type Page = Awaited<ReturnType<BrowserContext['newPage']>>;

let playwright: PlaywrightModule | null = null;

async function loadPlaywright(): Promise<PlaywrightModule> {
  if (!playwright) {
    try {
      playwright = await import('playwright');
    } catch {
      throw new Error('Playwright not installed. Run: pnpm add playwright');
    }
  }
  return playwright;
}

const DEFAULT_CDP_PORTS = [9222, 9223, 9224, 9225, 9226, 9227, 9228, 9229, 9230];

async function discoverChromeSession(ports: number[]): Promise<string | null> {
  for (const port of ports) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 500);
      const response = await fetch(`http://localhost:${port}/json/version`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (response.ok) {
        const data = (await response.json()) as { webSocketDebuggerUrl?: string };
        if (data.webSocketDebuggerUrl) {
          return `http://localhost:${port}`;
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

export type WebDriverOptions = {
  headless?: boolean;
  cdpPorts?: number[];
  userDataDir?: string;
};

export function createWebDriver(options: WebDriverOptions = {}): DeviceDriver {
  const config = {
    headless: options.headless,
    cdpPorts: options.cdpPorts ?? DEFAULT_CDP_PORTS,
    userDataDir: options.userDataDir,
  };

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let isConnectedSession = false;
  let connectionMode: 'existing' | 'launched' | 'headless' = 'launched';

  async function handleTap(payload: TapPayload): Promise<ActionResult> {
    if (!page) {
      return { success: false, error: 'Not connected', code: 'UNKNOWN' };
    }
    try {
      if (payload.elementId) {
        await page.click(payload.elementId);
      } else {
        await page.mouse.click(payload.x, payload.y);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error), code: 'UNKNOWN' };
    }
  }

  async function handleDoubleTap(payload: TapPayload): Promise<ActionResult> {
    if (!page) {
      return { success: false, error: 'Not connected', code: 'UNKNOWN' };
    }
    try {
      if (payload.elementId) {
        await page.dblclick(payload.elementId);
      } else {
        await page.mouse.dblclick(payload.x, payload.y);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error), code: 'UNKNOWN' };
    }
  }

  async function handleLongPress(payload: TapPayload): Promise<ActionResult> {
    if (!page) {
      return { success: false, error: 'Not connected', code: 'UNKNOWN' };
    }
    try {
      await page.mouse.move(payload.x, payload.y);
      await page.mouse.down();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await page.mouse.up();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error), code: 'UNKNOWN' };
    }
  }

  async function handleType(payload: TypePayload): Promise<ActionResult> {
    if (!page) {
      return { success: false, error: 'Not connected', code: 'UNKNOWN' };
    }
    try {
      if (payload.elementId) {
        await page.fill(payload.elementId, payload.text);
      } else {
        await page.keyboard.type(payload.text);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error), code: 'UNKNOWN' };
    }
  }

  async function handleKey(payload: KeyPayload): Promise<ActionResult> {
    if (!page) {
      return { success: false, error: 'Not connected', code: 'UNKNOWN' };
    }
    try {
      const key = mapKey(payload.key);
      const modifiers = payload.modifiers ?? [];

      for (const mod of modifiers) {
        await page.keyboard.down(mapModifier(mod));
      }

      await page.keyboard.press(key);

      for (const mod of modifiers.reverse()) {
        await page.keyboard.up(mapModifier(mod));
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error), code: 'UNKNOWN' };
    }
  }

  async function handleSwipe(payload: SwipePayload): Promise<ActionResult> {
    if (!page) {
      return { success: false, error: 'Not connected', code: 'UNKNOWN' };
    }
    try {
      const steps = 10;
      const duration = payload.durationMs ?? 300;
      const stepDelay = duration / steps;

      await page.mouse.move(payload.fromX, payload.fromY);
      await page.mouse.down();

      for (let i = 1; i <= steps; i++) {
        const progress = i / steps;
        const x = payload.fromX + (payload.toX - payload.fromX) * progress;
        const y = payload.fromY + (payload.toY - payload.fromY) * progress;
        await page.mouse.move(x, y);
        await new Promise((resolve) => setTimeout(resolve, stepDelay));
      }

      await page.mouse.up();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error), code: 'UNKNOWN' };
    }
  }

  async function handleScroll(payload: ScrollPayload): Promise<ActionResult> {
    if (!page) {
      return { success: false, error: 'Not connected', code: 'UNKNOWN' };
    }
    try {
      if (payload.x !== undefined && payload.y !== undefined) {
        await page.mouse.move(payload.x, payload.y);
      }
      await page.mouse.wheel(payload.deltaX, payload.deltaY);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error), code: 'UNKNOWN' };
    }
  }

  async function handleScreenshot(): Promise<ActionResult> {
    if (!page) {
      return { success: false, error: 'Not connected', code: 'UNKNOWN' };
    }
    try {
      const buffer = await page.screenshot({ type: 'png' });
      const viewport = page.viewportSize() ?? { width: 1920, height: 1080 };

      const data: ScreenshotData = {
        type: 'screenshot',
        base64: buffer.toString('base64'),
        format: 'png',
        width: viewport.width,
        height: viewport.height,
      };

      return { success: true, data };
    } catch (error) {
      return { success: false, error: String(error), code: 'UNKNOWN' };
    }
  }

  async function handleGetUITree(): Promise<ActionResult> {
    if (!page) {
      return { success: false, error: 'Not connected', code: 'UNKNOWN' };
    }
    try {
      const tree = await page.evaluate((): unknown => {
        const typeMap: Record<string, string> = {
          BUTTON: 'button',
          INPUT: 'input',
          TEXTAREA: 'input',
          A: 'button',
          IMG: 'image',
          P: 'text',
          SPAN: 'text',
          DIV: 'container',
          SECTION: 'container',
          ARTICLE: 'container',
          MAIN: 'container',
          HEADER: 'container',
          FOOTER: 'container',
          NAV: 'container',
        };

        function mapElementType(tagName: string): string {
          return typeMap[tagName] ?? 'unknown';
        }

        function buildTree(el: unknown): unknown {
          const element = el as {
            id?: string;
            tagName: string;
            textContent?: string;
            children: ArrayLike<unknown>;
            hasAttribute(name: string): boolean;
            disabled?: boolean;
            getBoundingClientRect(): { x: number; y: number; width: number; height: number };
          };
          const w = globalThis as unknown as {
            getComputedStyle(el: unknown): { display: string; visibility: string; cursor: string };
          };

          const rect = element.getBoundingClientRect();
          const style = w.getComputedStyle(element);

          return {
            id: element.id || `element-${Math.random().toString(36).slice(2, 9)}`,
            type: mapElementType(element.tagName),
            bounds: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            text: element.textContent?.trim().slice(0, 100) || undefined,
            clickable:
              element.tagName === 'BUTTON' ||
              element.tagName === 'A' ||
              style.cursor === 'pointer',
            focusable:
              element.hasAttribute('tabindex') ||
              ['INPUT', 'BUTTON', 'A', 'TEXTAREA', 'SELECT'].includes(element.tagName),
            enabled: !element.disabled,
            visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0,
            children: Array.from(element.children)
              .filter((child: unknown) => {
                const c = child as { getBoundingClientRect(): { width: number; height: number } };
                const childStyle = w.getComputedStyle(child);
                const childRect = c.getBoundingClientRect();
                return (
                  childStyle.display !== 'none' &&
                  childRect.width > 0 &&
                  childRect.height > 0
                );
              })
              .slice(0, 50)
              .map((child: unknown) => buildTree(child)),
          };
        }

        const doc = globalThis as unknown as { document: { body: unknown } };
        return buildTree(doc.document.body);
      });

      return {
        success: true,
        data: {
          type: 'ui_tree',
          root: tree as UIElement,
        },
      };
    } catch (error) {
      return { success: false, error: String(error), code: 'UNKNOWN' };
    }
  }

  function mapKey(key: string): string {
    const keyMap: Record<string, string> = {
      enter: 'Enter',
      return: 'Enter',
      tab: 'Tab',
      space: 'Space',
      escape: 'Escape',
      esc: 'Escape',
      backspace: 'Backspace',
      delete: 'Delete',
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
      home: 'Home',
      end: 'End',
      pageup: 'PageUp',
      pagedown: 'PageDown',
    };
    return keyMap[key.toLowerCase()] ?? key;
  }

  function mapModifier(mod: string): string {
    const modMap: Record<string, string> = {
      ctrl: 'Control',
      control: 'Control',
      alt: 'Alt',
      shift: 'Shift',
      meta: 'Meta',
      cmd: 'Meta',
      command: 'Meta',
    };
    return modMap[mod.toLowerCase()] ?? mod;
  }

  return {
    async connect(): Promise<void> {
      const pw = await loadPlaywright();

      const cdpUrl = await discoverChromeSession(config.cdpPorts);
      if (cdpUrl) {
        try {
          browser = await pw.chromium.connectOverCDP(cdpUrl);
          isConnectedSession = true;
          connectionMode = 'existing';

          const contexts = browser.contexts();
          if (contexts.length > 0) {
            context = contexts[0]!;
            const pages = context.pages();
            page = pages.length > 0 ? pages[0]! : await context.newPage();
          } else {
            context = await browser.newContext();
            page = await context.newPage();
          }
          return;
        } catch {
          browser = null;
        }
      }

      const headless = config.headless ?? false;
      browser = await pw.chromium.launch({
        headless,
        args: headless ? [] : ['--start-maximized'],
      });
      context = await browser.newContext(headless ? {} : { viewport: null });
      page = await context.newPage();
      isConnectedSession = false;
      connectionMode = headless ? 'headless' : 'launched';
    },

    async disconnect(): Promise<void> {
      if (browser) {
        if (!isConnectedSession) {
          await browser.close();
        }
        browser = null;
        context = null;
        page = null;
      }
    },

    async execute(action: DeviceAction): Promise<ActionResult> {
      if (!page) {
        return { success: false, error: 'Not connected. Call connect() first.', code: 'UNKNOWN' };
      }

      try {
        switch (action.type) {
          case 'tap':
            return await handleTap(action.payload as TapPayload);
          case 'double_tap':
            return await handleDoubleTap(action.payload as TapPayload);
          case 'long_press':
            return await handleLongPress(action.payload as TapPayload);
          case 'type':
            return await handleType(action.payload as TypePayload);
          case 'key':
            return await handleKey(action.payload as KeyPayload);
          case 'swipe':
            return await handleSwipe(action.payload as SwipePayload);
          case 'scroll':
            return await handleScroll(action.payload as ScrollPayload);
          case 'screenshot':
            return await handleScreenshot();
          case 'get_ui_tree':
            return await handleGetUITree();
          case 'drag':
            return { success: false, error: 'Drag not supported on web', code: 'NOT_SUPPORTED' };
          default:
            return { success: false, error: `Unknown action: ${action.type}`, code: 'NOT_SUPPORTED' };
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
      const viewport = page?.viewportSize() ?? { width: 1920, height: 1080 };

      const modeNames = {
        existing: 'Chrome (User Session)',
        launched: 'Chrome (Launched)',
        headless: 'Chrome (Headless)',
      };

      return {
        platform: 'web',
        deviceId: 'web-browser',
        deviceName: modeNames[connectionMode],
        screenSize: { width: viewport.width, height: viewport.height },
        supportedActions: [
          'tap',
          'double_tap',
          'type',
          'key',
          'scroll',
          'screenshot',
          'get_ui_tree',
        ],
        hasKeyboard: true,
        hasUITree: true,
      };
    },
  };
}

export { discoverChromeSession };
