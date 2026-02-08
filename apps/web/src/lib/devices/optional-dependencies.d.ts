declare module '@nut-tree-fork/nut-js' {
  export const mouse: unknown;
  export const keyboard: unknown;
  export const screen: unknown;
  export const Button: { LEFT: number; RIGHT: number; MIDDLE: number };
  export const Key: Record<string, number>;
  export class Point {
    constructor(x: number, y: number);
    x: number;
    y: number;
  }
}

declare module 'playwright' {
  export interface Browser {
    close(): Promise<void>;
    newPage(): Promise<Page>;
    newContext(options?: unknown): Promise<BrowserContext>;
    contexts(): BrowserContext[];
  }
  export interface Page {
    goto(url: string): Promise<void>;
    screenshot(options?: { type?: string }): Promise<Buffer>;
    click(selector: string, options?: unknown): Promise<void>;
    dblclick(selector: string, options?: unknown): Promise<void>;
    fill(selector: string, value: string): Promise<void>;
    viewportSize(): { width: number; height: number } | null;
    mouse: {
      move(x: number, y: number): Promise<void>;
      click(x: number, y: number, options?: unknown): Promise<void>;
      dblclick(x: number, y: number): Promise<void>;
      down(): Promise<void>;
      up(): Promise<void>;
      wheel(deltaX: number, deltaY: number): Promise<void>;
    };
    keyboard: {
      type(text: string): Promise<void>;
      press(key: string): Promise<void>;
      down(key: string): Promise<void>;
      up(key: string): Promise<void>;
    };
    evaluate<T>(fn: () => T): Promise<T>;
  }
  export interface BrowserContext {
    close(): Promise<void>;
    newPage(): Promise<Page>;
    pages(): Page[];
  }
  export const chromium: {
    launch(options?: unknown): Promise<Browser>;
    connectOverCDP(url: string): Promise<Browser>;
  };
}

declare module '@agent/mobile-accessibility' {
  export function parseAccessibilityTree(xml: string): unknown;
}
