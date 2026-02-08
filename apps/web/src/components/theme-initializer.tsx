'use client';

import { useEffect } from 'react';
import { useSettings } from '@/hooks/use-settings';

const accentColors: Record<string, string> = {
  '#00ff88': 'oklch(0.85 0.2 155)',
  '#3b82f6': 'oklch(0.6 0.2 250)',
  '#a855f7': 'oklch(0.65 0.25 295)',
  '#f59e0b': 'oklch(0.8 0.15 85)',
  '#ef4444': 'oklch(0.55 0.22 25)',
};

export function ThemeInitializer() {
  const { settings } = useSettings();

  useEffect(() => {
    const savedAccent = settings?.accentColor || localStorage.getItem('controlai-accent-color');
    if (savedAccent && accentColors[savedAccent]) {
      const cssValue = accentColors[savedAccent];
      document.documentElement.style.setProperty('--primary', cssValue);
      document.documentElement.style.setProperty('--ring', cssValue);
      document.documentElement.style.setProperty('--sidebar-primary', cssValue);
      document.documentElement.style.setProperty('--sidebar-ring', cssValue);
    }
  }, [settings?.accentColor]);

  return null;
}
