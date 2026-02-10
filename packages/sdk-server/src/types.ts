/**
 * @agent/sdk-server - Type Definitions
 */

import type { AgentOptions } from '@agent/sdk';
import type { QueueConfig } from './queue';
import type { StreamBufferOptions } from './stream-buffer';

/**
 * Options for creating an agent server
 */
export interface AgentServerOptions {
  /** Pre-configured agent instance */
  agent?: AgentInstance;
  
  /** Options to create a new agent (alternative to passing agent) */
  agentOptions?: AgentOptions;
  
  /** HTTP server port (default: 3000) */
  port?: number;
  
  /** CORS allowed origins (default: '*') */
  corsOrigin?: string | string[];
  
  /** Enable request logging */
  enableLogging?: boolean;

  /** API Key for authentication */
  apiKey?: string;

  /** Path to config file for dashboard (default: ./agent-sdk.config.yaml) */
  configPath?: string;

  /** Concurrency queue configuration for limiting simultaneous requests. */
  queue?: QueueConfig;

  /** Stream buffer configuration for resumable streams. */
  streamBuffer?: StreamBufferOptions;

  /** WebSocket upgrade function (injected by server factory). */
  upgradeWebSocket?: UpgradeWebSocketFn;

  /** Max request body size in bytes (default: 1 MB) */
  maxBodySize?: number;

  /** Browser stream configuration */
  browserStream?: {
    /** Enable browser viewport streaming (default: false) */
    enabled?: boolean;
    /** Default FPS for stream (default: 2) */
    fps?: number;
    /** Default JPEG quality (default: 60) */
    quality?: number;
  };
}

/**
 * Agent instance interface (minimal contract)
 * Full typing comes from @agent/sdk
 */
export interface AgentInstance {
  generate: (opts: GenerateOptions) => Promise<GenerateResult>;
  stream: (opts: GenerateOptions) => StreamResult;
}

/**
 * Extended agent instance with durable workflow capabilities.
 * Used for duck-type checking whether the agent supports resumable streams.
 */
export interface DurableAgentInstance extends AgentInstance {
  /** The workflow run ID from the last durable execution. */
  readonly workflowRunId?: string;
  /** Whether workflow runtime is active. */
  readonly isWorkflowActive?: boolean;
}

export interface GenerateOptions {
  prompt: string;
  options?: {
    userId?: string;
    sessionId?: string;
    complexity?: 'simple' | 'complex';
    role?: 'coder' | 'researcher' | 'analyst';
    enabledTools?: string[];
    workspaceRoot?: string;
  };
}

export interface GenerateResult {
  text: string;
  steps: unknown[];
}

export interface StreamResult {
  fullStream: AsyncIterable<StreamChunk>;
  text: Promise<string>;
}

export interface StreamChunk {
  type: string;
  [key: string]: unknown;
}

/**
 * WebSocket upgrade function type.
 * Provided by @hono/node-ws createNodeWebSocket().
 * Using `any` to avoid type conflicts with Hono's internal WSContext types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UpgradeWebSocketFn = (...args: any[]) => any;
