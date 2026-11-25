import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Search, FolderOpen, Pencil, Trash2, ArrowRight, Sparkles } from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';
import { useToast } from '@/contexts/ToastContext';
import { DEMO_PROJECT_BUNDLE } from '@/data/demoProject';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/common/EmptyState';

export function ProjectHistoryPage() {
  const { projects, setActiveProjectId, openDemoProject, renameProject, deleteProject } = useProject();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);

  const filtered = projects.filter((p) =>
    p.title.toLowerCase().includes(query.toLowerCase())
  );

  const handleOpen = (id: string, stage: number) => {
    setActiveProjectId(id);
    if (stage <= 1) navigate('/app/upload');
    else if (stage <= 3) navigate('/app/analysis');
    else if (stage === 4) navigate('/app/blueprint');
    else if (stage === 5) navigate('/app/datasets');
    else if (stage === 6) navigate('/app/code');
    else if (stage === 7) navigate('/app/execute');
    else if (stage === 8) navigate('/app/results');
    else navigate('/app/reports');
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget) return;
    try {
      await renameProject(renameTarget.id, renameTarget.title);
      notify('Project renamed', { kind: 'success' });
      setRenameTarget(null);
    } catch (err) {
      notify('Rename failed', {
        description: err instanceof Error ? err.message : 'Unable to rename',
        kind: 'error',
      });
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Permanently delete "${title}"?`)) return;
    try {
      await deleteProject(id);
      notify('Project deleted', { kind: 'success' });
    } catch (err) {
      notify('Delete failed', {
        description: err instanceof Error ? err.message : 'Unable to delete',
        kind: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <History className="h-6 w-6 text-violet-400" />
            Project History
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Reopen, continue, rename, or remove any of your research prototype projects.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <Input
            className="pl-9"
            placeholder="Filter projects..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Demo Project Row */}
      <Card className="border-violet-500/30 bg-navy-900/80">
        <CardContent className="flex flex-col justify-between gap-3 pt-5 sm:flex-row sm:items-center">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Badge variant="warning">DEMO DATA</Badge>
              <span className="font-semibold text-white">{DEMO_PROJECT_BUNDLE.project.title}</span>
            </div>
            <p className="text-xs text-slate-400">Built-in end-to-end sample workflow (read-only reference)</p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              openDemoProject();
              navigate('/app/analysis');
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Open Demo
          </Button>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={query ? 'No matching projects' : 'No saved projects yet'}
          description="Upload a PDF research paper to start tracking your projects here."
          actionLabel="Upload Paper"
          onAction={() => navigate('/app/upload')}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your Saved Projects ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {filtered.map((proj) => (
              <div
                key={proj.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-800 bg-navy-950/60 p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{proj.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Status: <span className="text-violet-300">{proj.status}</span> • Stage {proj.current_stage}/9 • Updated {formatDate(proj.updated_at)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button size="sm" onClick={() => handleOpen(proj.id, proj.current_stage)}>
                    Continue
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setRenameTarget({ id: proj.id, title: proj.title })}
                    title="Rename"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleDelete(proj.id, proj.title)}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ModalDialog
        open={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        title="Rename Project"
      >
        <form onSubmit={handleRename} className="space-y-4">
          <Input
            value={renameTarget?.title || ''}
            onChange={(e) => setRenameTarget((p) => (p ? { ...p, title: e.target.value } : null))}
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
