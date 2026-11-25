import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileUp,
  Microscope,
  Compass,
  CheckCircle2,
  FolderOpen,
  Pencil,
  Trash2,
  Sparkles,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useToast } from '@/contexts/ToastContext';
import { DEMO_PROJECT_BUNDLE } from '@/data/demoProject';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/common/EmptyState';
import { formatDate } from '@/lib/utils';

export function DashboardPage() {
  const { user, profile } = useAuth();
  const {
    projects,
    setActiveProjectId,
    openDemoProject,
    createProject,
    renameProject,
    deleteProject,
  } = useProject();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');

  const totalUploaded = projects.filter(
    (p) => p.stage_statuses?.['1'] === 'completed' || p.current_stage >= 2 || p.status !== 'created'
  ).length;
  const totalAnalyzed = projects.filter((p) =>
    ['analyzed', 'blueprint_ready', 'resources_ready', 'code_ready', 'executed', 'completed'].includes(p.status)
  ).length;
  const totalExperiments = projects.filter((p) =>
    ['blueprint_ready', 'resources_ready', 'code_ready', 'executed', 'completed'].includes(p.status)
  ).length;
  const totalCompleted = projects.filter((p) => p.status === 'completed').length;

  const stats = [
    { label: 'Total Papers Uploaded', value: totalUploaded, icon: FileUp, color: 'text-sky-400' },
    { label: 'Papers Analyzed', value: totalAnalyzed, icon: Microscope, color: 'text-violet-400' },
    { label: 'Experiments Generated', value: totalExperiments, icon: Compass, color: 'text-indigo-400' },
    { label: 'Projects Completed', value: totalCompleted, icon: CheckCircle2, color: 'text-emerald-400' },
  ];

  const handleOpenProject = (projectId: string, stage: number) => {
    setActiveProjectId(projectId);
    if (stage <= 1) navigate('/app/upload');
    else if (stage <= 3) navigate('/app/analysis');
    else if (stage === 4) navigate('/app/blueprint');
    else if (stage === 5) navigate('/app/datasets');
    else if (stage === 6) navigate('/app/code');
    else if (stage === 7) navigate('/app/execute');
    else if (stage === 8) navigate('/app/results');
    else navigate('/app/reports');
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget) return;
    try {
      await renameProject(renameTarget.id, renameTarget.title);
      notify('Project renamed', { kind: 'success' });
      setRenameTarget(null);
    } catch (err) {
      notify('Rename failed', {
        description: err instanceof Error ? err.message : 'Unable to rename project',
        kind: 'error',
      });
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}" and all associated analyses, code, and files?`)) return;
    try {
      await deleteProject(id);
      notify('Project deleted', { kind: 'success' });
    } catch (err) {
      notify('Delete failed', {
        description: err instanceof Error ? err.message : 'Unable to delete project',
        kind: 'error',
      });
    }
  };

  const handleCreateQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createProject(newProjectTitle || 'New Research Prototype');
      setNewProjectOpen(false);
      setNewProjectTitle('');
      navigate('/app/upload');
    } catch (err) {
      notify('Could not create project', {
        description: err instanceof Error ? err.message : 'Please sign in first.',
        kind: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-gradient-to-r from-navy-900 via-navy-900 to-violet-950/50 p-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Convert academic PDFs into reproducible experiment plans, starter code, and technical reports.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {user && (
            <Button variant="outline" onClick={() => setNewProjectOpen(true)}>
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          )}
          <Button onClick={() => navigate('/app/upload')}>
            <FileUp className="h-4 w-4" />
            Upload New Research Paper
          </Button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="flex items-center justify-between pt-5">
                <div>
                  <p className="text-xs font-medium text-slate-400">{s.label}</p>
                  <p className="mt-1.5 text-3xl font-bold text-white">{s.value}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-800/80">
                  <Icon className={`h-5 w-5 ${s.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Featured Sample Demo Project */}
      <Card className="border-violet-500/35 bg-gradient-to-br from-navy-900 to-violet-950/25">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <Badge variant="warning">DEMO DATA</Badge>
              <Badge variant="default">Built-In Reference</Badge>
            </div>
            <CardTitle>{DEMO_PROJECT_BUNDLE.project.title}</CardTitle>
            <CardDescription>{DEMO_PROJECT_BUNDLE.project.description}</CardDescription>
          </div>
          <Button
            onClick={() => {
              openDemoProject();
              navigate('/app/analysis');
            }}
            className="shrink-0"
          >
            <Sparkles className="h-4 w-4" />
            Open Demo Project
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardHeader>
      </Card>

      {/* Recent Projects */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Recent Research Projects</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/history')}>
            View Full History
          </Button>
        </div>

        {projects.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={user ? 'No research projects yet' : 'Sign in to save your own projects'}
            description={
              user
                ? 'Upload your first academic PDF paper to run AI extraction, blueprint generation, and Python code synthesis.'
                : 'Sign in with your Supabase account to upload papers and save your workflow, or explore the Sample Demo Project above.'
            }
            actionLabel={user ? 'Upload Research Paper' : 'Sign In / Sign Up'}
            onAction={() => navigate(user ? '/app/upload' : '/auth')}
            secondaryLabel="Open Sample Demo"
            onSecondaryAction={() => {
              openDemoProject();
              navigate('/app/analysis');
            }}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projects.slice(0, 6).map((proj) => (
              <Card key={proj.id} className="transition-colors hover:border-violet-500/40">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{proj.title}</CardTitle>
                      <CardDescription className="mt-1">
                        Updated {formatDate(proj.updated_at)}
                      </CardDescription>
                    </div>
                    <Badge variant={proj.status === 'completed' ? 'success' : 'default'}>
                      Stage {proj.current_stage}/9
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-2">
                  <Button size="sm" onClick={() => handleOpenProject(proj.id, proj.current_stage)}>
                    Continue Workflow
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Rename project"
                      onClick={() => setRenameTarget({ id: proj.id, title: proj.title })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Delete project"
                      onClick={() => handleDelete(proj.id, proj.title)}
                    >
                      <Trash2 className="h-4 w-4 text-rose-400" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Rename Modal */}
      <ModalDialog
        open={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        title="Rename Research Project"
      >
        <form onSubmit={handleRenameSubmit} className="space-y-4">
          <Input
            value={renameTarget?.title || ''}
            onChange={(e) =>
              setRenameTarget((prev) => (prev ? { ...prev, title: e.target.value } : null))
            }
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button type="submit">Save Title</Button>
          </div>
        </form>
      </ModalDialog>

      {/* New Project Modal */}
      <ModalDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        title="Create New Research Project"
        description="Start a new workspace before uploading your PDF."
      >
        <form onSubmit={handleCreateQuick} className="space-y-4">
          <Input
            placeholder="e.g., Attention Is All You Need Reproduction"
            value={newProjectTitle}
            onChange={(e) => setNewProjectTitle(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setNewProjectOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create & Upload PDF</Button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
