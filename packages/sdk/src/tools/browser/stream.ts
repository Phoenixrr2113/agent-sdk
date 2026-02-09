/**
 * @fileoverview Browser viewport streaming.
 * Captures screenshots in a loop via agent-browser CLI and emits frames.
 * Supports user input injection (click, type, press, scroll).
 */

import { EventEmitter } from 'node:events';
import { executeBrowserCommand, buildCommand, isBrowserCliAvailable } from './tool';
import type { BrowserConfig } from './types';

// ============================================================================
// Types
// ============================================================================

export interface BrowserStreamConfig {
  /** Frames per second (default: 2, max: 10) */
  fps?: number;
  /** JPEG quality 1-100 (default: 60) */
  quality?: number;
  /** Viewport width to resize to before capture */
  width?: number;
  /** Viewport height to resize to before capture */
  height?: number;
}

export interface FrameData {
  /** Base64-encoded JPEG image data */
  data: string;
  /** Capture timestamp (ms since epoch) */
  timestamp: number;
  /** Frame sequence number */
  sequence: number;
}

export type InputEvent =
  | { type: 'click'; x: number; y: number }
  | { type: 'type'; text: string; selector?: string }
  | { type: 'press'; key: string }
  | { type: 'scroll'; direction: 'up' | 'down' | 'left' | 'right'; pixels?: number }
  | { type: 'fill'; selector: string; text: string };

export type BrowserStreamEvent =
  | { type: 'frame'; frame: FrameData }
  | { type: 'error'; error: string }
  | { type: 'started'; config: BrowserStreamConfig }
  | { type: 'stopped' }
  | { type: 'input-ack'; inputType: string; success: boolean; error?: string };

// ============================================================================
// Constants
// ============================================================================

const MIN_FPS = 0.5;
const MAX_FPS = 10;
const DEFAULT_FPS = 2;
const DEFAULT_QUALITY = 60;
const CAPTURE_TIMEOUT = 10_000;

// ============================================================================
// BrowserStreamEmitter
// ============================================================================

export interface BrowserStreamEmitterEvents {
  frame: [frame: FrameData];
  error: [error: string];
  started: [config: BrowserStreamConfig];
  stopped: [];
  'input-ack': [inputType: string, success: boolean, error?: string];
}

export class BrowserStreamEmitter extends EventEmitter {
  private config: Required<BrowserStreamConfig>;
  private browserConfig: BrowserConfig;
  private captureTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private sequence = 0;
  private capturing = false;

  constructor(
    streamConfig: BrowserStreamConfig = {},
    browserConfig: BrowserConfig = {},
  ) {
    super();
    this.config = {
      fps: clampFps(streamConfig.fps ?? DEFAULT_FPS),
      quality: Math.max(1, Math.min(100, streamConfig.quality ?? DEFAULT_QUALITY)),
      width: streamConfig.width ?? 1280,
      height: streamConfig.height ?? 720,
    };
    this.browserConfig = browserConfig;
  }

  /**
   * Safely emit an error event.
   * EventEmitter throws if 'error' is emitted without a listener,
   * so we check first and fall back to console.error.
   */
  private safeEmitError(message: string): void {
    if (this.listenerCount('error') > 0) {
      this.emit('error', message);
    } else {
      // eslint-disable-next-line no-console
      console.error('[BrowserStream]', message);
    }
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  async start(): Promise<void> {
    if (this.running) return;

    const available = await isBrowserCliAvailable();
    if (!available) {
      this.safeEmitError('agent-browser CLI not found. Cannot start browser stream.');
      return;
    }

    this.running = true;
    this.sequence = 0;
    this.emit('started', { ...this.config });
    this.scheduleCapture();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.captureTimer) {
      clearTimeout(this.captureTimer);
      this.captureTimer = null;
    }
    this.emit('stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  getConfig(): Readonly<Required<BrowserStreamConfig>> {
    return { ...this.config };
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  setConfig(update: Partial<BrowserStreamConfig>): void {
    if (update.fps !== undefined) {
      this.config.fps = clampFps(update.fps);
    }
    if (update.quality !== undefined) {
      this.config.quality = Math.max(1, Math.min(100, update.quality));
    }
    if (update.width !== undefined) {
      this.config.width = update.width;
    }
    if (update.height !== undefined) {
      this.config.height = update.height;
    }
  }

  // --------------------------------------------------------------------------
  // Input Injection
  // --------------------------------------------------------------------------

  async injectInput(event: InputEvent): Promise<{ success: boolean; error?: string }> {
    try {
      let args: string[];

      switch (event.type) {
        case 'click':
          // Use eval to click at coordinates since agent-browser click uses selectors
          args = buildCommand(
            { action: 'eval', js: `document.elementFromPoint(${event.x}, ${event.y})?.click()` },
            this.browserConfig,
          );
          break;

        case 'type':
          if (event.selector) {
            args = buildCommand(
              { action: 'type', selector: event.selector, text: event.text },
              this.browserConfig,
            );
          } else {
            args = buildCommand(
              { action: 'press', key: event.text },
              this.browserConfig,
            );
          }
          break;

        case 'press':
          args = buildCommand(
            { action: 'press', key: event.key },
            this.browserConfig,
          );
          break;

        case 'scroll':
          args = buildCommand(
            { action: 'scroll', direction: event.direction, pixels: event.pixels },
            this.browserConfig,
          );
          break;

        case 'fill':
          args = buildCommand(
            { action: 'fill', selector: event.selector, text: event.text },
            this.browserConfig,
          );
          break;

        default:
          return { success: false, error: `Unknown input event type` };
      }

      const result = await executeBrowserCommand(args, CAPTURE_TIMEOUT);

      const success = result.exitCode === 0;
      const ackResult = { success, error: success ? undefined : result.stderr };
      this.emit('input-ack', event.type, ackResult.success, ackResult.error);
      return ackResult;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.emit('input-ack', event.type, false, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  // --------------------------------------------------------------------------
  // Frame Capture
  // --------------------------------------------------------------------------

  private scheduleCapture(): void {
    if (!this.running) return;

    const intervalMs = 1000 / this.config.fps;

    this.captureTimer = setTimeout(async () => {
      if (!this.running) return;

      // Skip if previous capture is still running (avoid flooding)
      if (this.capturing) {
        this.scheduleCapture();
        return;
      }

      this.capturing = true;
      try {
        await this.captureFrame();
      } finally {
        this.capturing = false;
        this.scheduleCapture();
      }
    }, intervalMs);
  }

  private async captureFrame(): Promise<void> {
    try {
      // Use the screenshot action to capture the viewport.
      // The agent-browser CLI outputs the screenshot to a file, so we use a tmp path
      // and read it back as base64. This is the most reliable approach.
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');
      const { readFile, unlink } = await import('node:fs/promises');

      const tmpPath = join(tmpdir(), `browser-stream-${Date.now()}-${this.sequence}.png`);

      const args = buildCommand(
        { action: 'screenshot', path: tmpPath },
        this.browserConfig,
      );

      const result = await executeBrowserCommand(args, CAPTURE_TIMEOUT);

      if (result.exitCode !== 0) {
        this.safeEmitError(`Screenshot capture failed: ${result.stderr}`);
        return;
      }

      // Read the screenshot file and convert to base64
      try {
        const imageBuffer = await readFile(tmpPath);
        const base64Data = imageBuffer.toString('base64');

        const frame: FrameData = {
          data: base64Data,
          timestamp: Date.now(),
          sequence: this.sequence++,
        };

        this.emit('frame', frame);

        // Clean up temp file
        await unlink(tmpPath).catch(() => { });
      } catch (readErr) {
        this.safeEmitError(`Failed to read screenshot: ${readErr instanceof Error ? readErr.message : String(readErr)}`);
      }
    } catch (err) {
      this.safeEmitError(`Frame capture error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function clampFps(fps: number): number {
  return Math.max(MIN_FPS, Math.min(MAX_FPS, fps));
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a browser stream emitter for real-time viewport streaming.
 *
 * @example
 * ```ts
 * const stream = createBrowserStream({ fps: 3, quality: 70 });
 * stream.on('frame', (frame) => {
 *   // Send frame.data (base64) to client
 * });
 * stream.on('error', (err) => console.error(err));
 * await stream.start();
 * // Later:
 * stream.stop();
 * ```
 */
export function createBrowserStream(
  streamConfig?: BrowserStreamConfig,
  browserConfig?: BrowserConfig,
): BrowserStreamEmitter {
  return new BrowserStreamEmitter(streamConfig, browserConfig);
}
