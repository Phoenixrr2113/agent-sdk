import { generateId } from 'ai';
import type { ChatMessage } from './types';

export interface Session {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  messages: ChatMessage[];
  metadata?: Record<string, unknown>;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();

  /**
   * Create a new session
   */
  create(metadata?: Record<string, unknown>): Session {
    const id = generateId();
    const session: Session = {
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
      metadata,
    };
    this.sessions.set(id, session);
    return session;
  }

  /**
   * Get a session by ID
   */
  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  /**
   * Add a message to a session
   */
  addMessage(sessionId: string, message: ChatMessage): void {
    const session = this.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    session.messages.push(message);
    session.updatedAt = new Date();
  }

  /**
   * Get message history for a session
   */
  getHistory(sessionId: string): ChatMessage[] {
    const session = this.get(sessionId);
    return session ? [...session.messages] : [];
  }

  /**
   * Clear session history
   */
  clear(sessionId: string): void {
    const session = this.get(sessionId);
    if (session) {
      session.messages = [];
      session.updatedAt = new Date();
    }
  }

  /**
   * Delete a session
   */
  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }
}
