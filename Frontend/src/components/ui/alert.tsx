import * as React from 'react';
import { cn } from '@/lib/utils';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'warning' | 'destructive' | 'success' | 'info';
}

const variantStyles: Record<NonNullable<AlertProps['variant']>, string> = {
  default: 'border-slate-700 bg-navy-900/90 text-slate-200',
  info: 'border-sky-500/40 bg-sky-950/40 text-sky-100',
  warning: 'border-amber-500/40 bg-amber-950/35 text-amber-100',
  destructive: 'border-rose-500/40 bg-rose-950/40 text-rose-100',
  success: 'border-emerald-500/40 bg-emerald-950/35 text-emerald-100',
};

export function Alert({ variant = 'default', className, children, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn('rounded-xl border p-4 text-sm leading-relaxed', variantStyles[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}
