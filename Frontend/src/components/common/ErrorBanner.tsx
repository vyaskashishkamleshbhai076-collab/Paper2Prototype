import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function ErrorBanner({
  title = 'Operation Failed',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
        <div>
          <p className="font-semibold text-rose-100">{title}</p>
          <p className="mt-0.5 text-sm text-rose-200/90">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="shrink-0 border-rose-400/40">
          <RotateCcw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </Alert>
  );
}
