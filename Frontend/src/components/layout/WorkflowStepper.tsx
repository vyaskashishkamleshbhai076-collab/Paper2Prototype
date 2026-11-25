import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, CircleDot, AlertCircle } from 'lucide-react';
import { WORKFLOW_STAGES, ResearchProject } from '@/types';
import { cn } from '@/lib/utils';

export function WorkflowStepper({ project }: { project: ResearchProject | null }) {
  const navigate = useNavigate();
  const location = useLocation();

  if (!project) return null;

  const isViewingStage = (route: string, stageNum: number) => {
    const [routePath, routeQuery] = route.split('?');
    if (location.pathname !== routePath) return false;
    if (routeQuery) {
      return location.search.includes(routeQuery);
    }
    if (stageNum === 2 && location.search.includes('tab=methodology')) return false;
    return true;
  };

  return (
    <div className="rounded-xl border border-slate-800/80 bg-navy-900/60 p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          9-Stage Research-to-Prototype Pipeline
        </span>
        <span className="text-xs text-violet-300">
          Stage {project.current_stage} of {WORKFLOW_STAGES.length}
        </span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {WORKFLOW_STAGES.map((stage) => {
          const status = project.stage_statuses?.[String(stage.stage)] || 'pending';
          const isCurrent = isViewingStage(stage.route, stage.stage) || project.current_stage === stage.stage;
          const isViewing = isViewingStage(stage.route, stage.stage);
          const isDone = status === 'completed';
          const isError = status === 'error';

          return (
            <button
              key={stage.stage}
              type="button"
              onClick={() => navigate(stage.route)}
              title={`${stage.stage}. ${stage.label}: ${stage.description}`}
              className={cn(
                'flex min-w-[110px] flex-1 items-center gap-2 rounded-lg border px-2 py-2 text-left transition-all lg:min-w-0',
                isViewing && 'border-violet-400 bg-violet-600/30 text-white shadow-sm ring-1 ring-violet-400/50',
                !isViewing && isCurrent && 'border-violet-500 bg-violet-600/20 text-white shadow-sm',
                !isViewing && !isCurrent && isDone && 'border-emerald-500/30 bg-emerald-950/25 text-emerald-200 hover:border-emerald-400/50',
                !isViewing && !isCurrent && isError && 'border-rose-500/40 bg-rose-950/30 text-rose-200',
                !isViewing && !isCurrent && !isDone && !isError && 'border-slate-800 bg-navy-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                  isDone && 'bg-emerald-500/20 text-emerald-300',
                  isCurrent && !isDone && 'bg-violet-500 text-white',
                  isError && 'bg-rose-500/20 text-rose-300',
                  !isDone && !isCurrent && !isError && 'bg-slate-800 text-slate-400'
                )}
              >
                {isDone ? (
                  <Check className="h-3 w-3" />
                ) : isError ? (
                  <AlertCircle className="h-3 w-3" />
                ) : isCurrent ? (
                  <CircleDot className="h-3 w-3" />
                ) : (
                  stage.stage
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{stage.shortLabel}</p>
                <p className="truncate text-[10px] opacity-70">Stage {stage.stage}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
