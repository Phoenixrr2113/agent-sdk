'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type ShortcutHandler = () => void;

type Shortcuts = {
  [key: string]: ShortcutHandler;
};

export function useKeyboardShortcuts(shortcuts: Shortcuts) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger in input fields
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      (event.target as HTMLElement)?.isContentEditable
    ) {
      return;
    }

    const key = [
      event.metaKey || event.ctrlKey ? 'mod' : '',
      event.shiftKey ? 'shift' : '',
      event.altKey ? 'alt' : '',
      event.key.toLowerCase(),
    ]
      .filter(Boolean)
      .join('+');

    const handler = shortcuts[key];
    if (handler) {
      event.preventDefault();
      handler();
    }
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Pre-built navigation shortcuts
export function useNavigationShortcuts(onOpenCommandPalette: () => void) {
  const router = useRouter();

  useKeyboardShortcuts({
    'mod+k': onOpenCommandPalette,
    'mod+/': onOpenCommandPalette,
    'g+d': () => router.push('/dashboard'),
    'g+c': () => router.push('/dashboard/chat'),
    'g+m': () => router.push('/dashboard/missions'),
    'g+a': () => router.push('/dashboard/automations'),
    'g+v': () => router.push('/dashboard/vault'),
    'g+s': () => router.push('/dashboard/settings'),
  });
}
