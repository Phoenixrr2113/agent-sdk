'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  const isNetworkError = error.message?.includes('fetch') || error.message?.includes('network');
  const isAuthError = error.message?.includes('auth') || error.message?.includes('unauthorized');

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      
      <h2 className="mt-6 text-2xl font-semibold">Something went wrong</h2>
      
      <p className="mt-2 max-w-md text-center text-muted-foreground">
        {isNetworkError 
          ? 'Unable to connect to the server. Please check your connection and try again.'
          : isAuthError
          ? 'Your session may have expired. Please sign in again.'
          : error.message || 'An unexpected error occurred in the dashboard.'}
      </p>

      {error.digest && (
        <p className="mt-2 text-xs text-muted-foreground">
          Error ID: {error.digest}
        </p>
      )}

      <div className="mt-8 flex gap-3">
        <Button onClick={reset} variant="default" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
        <Button 
          onClick={() => window.location.href = '/dashboard'} 
          variant="outline"
          className="gap-2"
        >
          <Home className="h-4 w-4" />
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
