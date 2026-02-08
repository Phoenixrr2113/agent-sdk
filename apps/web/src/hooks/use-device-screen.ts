'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import type { ActionResult, ScreenshotData } from '@/types/motia';

type UseDeviceScreenOptions = {
  deviceId: string;
  refreshInterval?: number;
  enabled?: boolean;
};

type UseDeviceScreenReturn = {
  screenshot: string | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
  setRefreshInterval: (ms: number) => void;
  pause: () => void;
  resume: () => void;
};

export function useDeviceScreen(options: UseDeviceScreenOptions): UseDeviceScreenReturn {
  const { deviceId, refreshInterval: initialInterval = 1000, enabled: initialEnabled = true } = options;
  
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshInterval, setRefreshIntervalState] = useState(initialInterval);
  const [enabled, setEnabled] = useState(initialEnabled);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const isVisibleRef = useRef(true);

  const fetchScreenshot = useCallback(async () => {
    if (!enabled || !isVisibleRef.current) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const result = await api.post<{ result: ActionResult }>(`/api/devices/${deviceId}/actions`, {
        type: 'screenshot',
        payload: {}
      });
      
      if (result.result.success && result.result.data && typeof result.result.data === 'object' && 'type' in result.result.data && result.result.data.type === 'screenshot') {
        const screenshotData = result.result.data as ScreenshotData;
        
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
        
        const base64Image = `data:image/${screenshotData.format};base64,${screenshotData.base64}`;
        setScreenshot(base64Image);
      } else if (!result.result.success && 'error' in result.result) {
        throw new Error(result.result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch screenshot'));
    } finally {
      setIsLoading(false);
    }
  }, [deviceId, enabled]);

  const refresh = useCallback(() => {
    fetchScreenshot();
  }, [fetchScreenshot]);

  const pause = useCallback(() => {
    setEnabled(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    setEnabled(true);
  }, []);

  const setRefreshInterval = useCallback((ms: number) => {
    setRefreshIntervalState(ms);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
      if (isVisibleRef.current && enabled) {
        fetchScreenshot();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, fetchScreenshot]);

  useEffect(() => {
    if (enabled && refreshInterval > 0) {
      fetchScreenshot();
      
      intervalRef.current = setInterval(() => {
        fetchScreenshot();
      }, refreshInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
    return undefined;
  }, [enabled, refreshInterval, fetchScreenshot]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return {
    screenshot,
    isLoading,
    error,
    refresh,
    setRefreshInterval,
    pause,
    resume,
  };
}
