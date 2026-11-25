import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function LoadingSpinner({
  title = 'Processing with AI...',
  subtitle = 'Extracting structured research insights cleanly without truncating content.',
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <Card className="border-violet-500/30 bg-gradient-to-br from-navy-900 to-violet-950/30">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20 text-violet-300">
          <Loader2 className="h-7 w-7 animate-spin" />
          <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-violet-400" />
        </div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="mt-1.5 max-w-md text-sm text-slate-400">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
