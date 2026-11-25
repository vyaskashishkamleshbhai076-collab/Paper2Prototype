import * as React from 'react';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
}

export function Progress({ value = 0, className, ...props }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('relative h-2.5 w-full overflow-hidden rounded-full bg-navy-800', className)}
      {...props}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-400 transition-all duration-300"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
