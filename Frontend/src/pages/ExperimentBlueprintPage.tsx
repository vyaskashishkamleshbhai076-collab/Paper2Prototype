import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Sparkles, Save, ArrowRight, Cpu, HardDrive, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';
import { useToast } from '@/contexts/ToastContext';
import { generateBlueprintApi } from '@/lib/api';
import { ExperimentBlueprint, ImplementationLevel } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';

const LEVELS: Array<{ key: ImplementationLevel; label: string; desc: string }> = [
  { key: 'beginner', label: 'A. Beginner', desc: 'CPU-friendly minimal baseline prototype' },
  { key: 'intermediate', label: 'B. Intermediate', desc: 'Modular core architecture & metrics' },
  { key: 'advanced', label: 'C. Advanced', desc: 'Full-fidelity reproduction & ablations' },
];

export function ExperimentBlueprintPage() {
  const { activeBundle, refreshActiveBundle, saveBlueprintEdits, selectBlueprintLevel } = useProject();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [selectedLevel, setSelectedLevel] = useState<ImplementationLevel>('intermediate');
  const [draft, setDraft] = useState<ExperimentBlueprint | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const lastProjectIdRef = useRef<string | null>(null);

  const blueprints = activeBundle?.blueprints || [];
  const activeProjectId = activeBundle?.project.id ?? null;

  // Initialize selectedLevel only when switching projects (never override an explicit level click)
  useEffect(() => {
    if (activeProjectId !== lastProjectIdRef.current) {
      lastProjectIdRef.current = activeProjectId;
      if (blueprints.length > 0) {
        const selected = blueprints.find((b) => b.is_selected) || blueprints[0];
        setSelectedLevel(selected.implementation_level);
        setDraft(selected);
      } else {
        setSelectedLevel('intermediate');
        setDraft(null);
      }
      return;
    }

    const match = blueprints.find((b) => b.implementation_level === selectedLevel);
    setDraft(match || null);
  }, [activeProjectId, blueprints, selectedLevel]);

  if (!activeBundle) {
    return (
      <EmptyState
        icon={Compass}
        title="No Project Selected"
        description="Analyze a research paper first to generate Beginner, Intermediate, and Advanced experiment blueprints."
        actionLabel="Go to Upload Paper"
        onAction={() => navigate('/app/upload')}
      />
    );
  }

  const { project, analysis } = activeBundle;

  if (!analysis) {
    return (
      <EmptyState
        icon={Compass}
        title="Complete Stage 2 Analysis First"
        description="Run AI Research Paper Analysis before generating an experiment blueprint."
        actionLabel="Go to Research Analysis"
        onAction={() => navigate('/app/analysis')}
      />
    );
  }

  const handleGenerate = async (level: ImplementationLevel) => {
    if (project.is_demo) {
      await selectBlueprintLevel(project.id, level);
      setSelectedLevel(level);
      return;
    }
    setGenerating(true);
    setErrorMsg(null);
    try {
      const res = await generateBlueprintApi(project.id, level);
      setSelectedLevel(level);
      await refreshActiveBundle(project.id);
      setDraft(res.blueprint);
      notify(`${level.toUpperCase()} Blueprint Generated`, { kind: 'success' });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate blueprint.');
    } finally {
      setGenerating(false);
    }
  };

  const handleLevelSwitch = async (level: ImplementationLevel) => {
    setSelectedLevel(level);
    const existing = blueprints.find((b) => b.implementation_level === level);
    if (existing) {
      setDraft(existing);
      await selectBlueprintLevel(project.id, level);
    } else {
      setDraft(null);
    }
  };

  const handleSaveEdits = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await saveBlueprintEdits(draft);
      notify('Blueprint edits saved', { kind: 'success' });
    } catch (err) {
      notify('Save failed', {
        description: err instanceof Error ? err.message : 'Could not save blueprint',
        kind: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge>Stage 4 of 9</Badge>
            {project.is_demo && <Badge variant="warning">DEMO DATA</Badge>}
          </div>
          <h1 className="text-2xl font-bold text-white">Experiment Blueprint Generator</h1>
          <p className="mt-1 text-sm text-slate-400">
            Select an implementation complexity tier, customize every field, and save your blueprint.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {draft && (
            <Button variant="outline" onClick={handleSaveEdits} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Edits'}
            </Button>
          )}
          <Button onClick={() => navigate('/app/datasets')}>
            Next: Dataset Finder
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Level Selector Cards */}
      <div className="grid gap-3 md:grid-cols-3">
        {LEVELS.map((lvl) => {
          const exists = blueprints.some((b) => b.implementation_level === lvl.key);
          const isCurrent = selectedLevel === lvl.key;
          return (
            <button
              key={lvl.key}
              type="button"
              onClick={() => handleLevelSwitch(lvl.key)}
              className={cn(
                'rounded-xl border p-4 text-left transition-all',
                isCurrent
                  ? 'border-violet-500 bg-violet-600/20 shadow-md'
                  : 'border-slate-800 bg-navy-900/60 hover:border-slate-700'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">{lvl.label}</span>
                {exists ? (
                  <Badge variant="success">
                    <CheckCircle2 className="h-3 w-3" />
                    Ready
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not Generated</Badge>
                )}
              </div>
              <p className="mt-1.5 text-xs text-slate-400">{lvl.desc}</p>
            </button>
          );
        })}
      </div>

      {errorMsg && <ErrorBanner message={errorMsg} onRetry={() => handleGenerate(selectedLevel)} />}

      {generating && (
        <LoadingSpinner
          title={`Generating ${selectedLevel.toUpperCase()} Experiment Blueprint...`}
          subtitle="Designing hardware specs, I/O contracts, step-by-step plan, and risk assessment."
        />
      )}

      {!generating && !draft && (
        <EmptyState
          icon={Compass}
          title={`No ${selectedLevel.toUpperCase()} Blueprint Yet`}
          description="Generate an editable experiment plan tailored to this implementation complexity level."
          actionLabel={`Generate ${selectedLevel.toUpperCase()} Blueprint`}
          onAction={() => handleGenerate(selectedLevel)}
        />
      )}

      {!generating && draft && (
        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-navy-900/50 px-4 py-3">
            <span className="text-xs text-slate-400">
              Every field below (hardware, software, libraries, steps, challenges, specs) is editable. Click <strong>Save Edits</strong> to persist changes.
            </span>
            {!project.is_demo && (
              <Button size="sm" variant="outline" onClick={() => handleGenerate(selectedLevel)}>
                <Sparkles className="h-3.5 w-3.5" />
                Regenerate {selectedLevel}
              </Button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Experiment Title & Objective</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Experiment Title</label>
                  <Input
                    value={draft.experiment_title}
                    onChange={(e) => setDraft({ ...draft, experiment_title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Objective</label>
                  <Textarea
                    rows={3}
                    value={draft.experiment_objective}
                    onChange={(e) => setDraft({ ...draft, experiment_objective: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Estimated Complexity</label>
                  <Input
                    value={draft.estimated_complexity}
                    onChange={(e) => setDraft({ ...draft, estimated_complexity: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-violet-400" />
                  Hardware, Software & Python Libraries
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">CPU</label>
                    <Input
                      value={draft.hardware_requirements?.cpu || ''}
                      placeholder="4+ cores"
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          hardware_requirements: { ...draft.hardware_requirements, cpu: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">RAM</label>
                    <Input
                      value={draft.hardware_requirements?.ram || ''}
                      placeholder="8 GB"
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          hardware_requirements: { ...draft.hardware_requirements, ram: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">GPU</label>
                    <Input
                      value={draft.hardware_requirements?.gpu || ''}
                      placeholder="Optional"
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          hardware_requirements: { ...draft.hardware_requirements, gpu: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">Storage</label>
                    <Input
                      value={draft.hardware_requirements?.storage || ''}
                      placeholder="2 GB"
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          hardware_requirements: { ...draft.hardware_requirements, storage: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Required Software</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() =>
                        setDraft({ ...draft, required_software: [...draft.required_software, 'Python 3.10+'] })
                      }
                    >
                      <Plus className="h-3 w-3" />
                      Add
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    {draft.required_software.map((sw, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <Input
                          value={sw}
                          onChange={(e) => {
                            const next = [...draft.required_software];
                            next[i] = e.target.value;
                            setDraft({ ...draft, required_software: next });
                          }}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label="Remove software"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              required_software: draft.required_software.filter((_, idx) => idx !== i),
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Python Libraries</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          python_libraries: [
                            ...draft.python_libraries,
                            { name: 'numpy', version_hint: '>=1.26', purpose: 'Numerical arrays' },
                          ],
                        })
                      }
                    >
                      <Plus className="h-3 w-3" />
                      Add Library
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {draft.python_libraries.map((lib, i) => (
                      <div key={i} className="grid grid-cols-12 items-center gap-1.5">
                        <Input
                          className="col-span-4 font-mono text-xs"
                          placeholder="package"
                          value={lib.name}
                          onChange={(e) => {
                            const next = [...draft.python_libraries];
                            next[i] = { ...lib, name: e.target.value };
                            setDraft({ ...draft, python_libraries: next });
                          }}
                        />
                        <Input
                          className="col-span-3 font-mono text-xs"
                          placeholder=">=1.0"
                          value={lib.version_hint || ''}
                          onChange={(e) => {
                            const next = [...draft.python_libraries];
                            next[i] = { ...lib, version_hint: e.target.value };
                            setDraft({ ...draft, python_libraries: next });
                          }}
                        />
                        <Input
                          className="col-span-4 text-xs"
                          placeholder="Purpose"
                          value={lib.purpose}
                          onChange={(e) => {
                            const next = [...draft.python_libraries];
                            next[i] = { ...lib, purpose: e.target.value };
                            setDraft({ ...draft, python_libraries: next });
                          }}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="col-span-1"
                          aria-label="Remove library"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              python_libraries: draft.python_libraries.filter((_, idx) => idx !== i),
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-violet-400" />
                Dataset & I/O Specifications
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Dataset Requirements</label>
                <Textarea
                  rows={3}
                  value={draft.dataset_requirements}
                  onChange={(e) => setDraft({ ...draft, dataset_requirements: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Input Specifications</label>
                <Textarea
                  rows={3}
                  value={draft.input_specifications}
                  onChange={(e) => setDraft({ ...draft, input_specifications: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Output Specifications</label>
                <Textarea
                  rows={3}
                  value={draft.output_specifications}
                  onChange={(e) => setDraft({ ...draft, output_specifications: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Step-by-Step Implementation Plan</CardTitle>
                <CardDescription>Edit step titles, durations, and details, or add/remove steps.</CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setDraft({
                    ...draft,
                    step_by_step_implementation: [
                      ...draft.step_by_step_implementation,
                      {
                        step: draft.step_by_step_implementation.length + 1,
                        title: 'New Implementation Step',
                        details: '',
                        estimated_minutes: 15,
                      },
                    ],
                  })
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Add Step
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {draft.step_by_step_implementation.map((step, idx) => (
                <div key={idx} className="space-y-2 rounded-xl border border-slate-800 bg-navy-950/60 p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Step {idx + 1}</Badge>
                    <Input
                      className="min-w-[200px] flex-1 font-semibold"
                      value={step.title}
                      onChange={(e) => {
                        const next = [...draft.step_by_step_implementation];
                        next[idx] = { ...step, step: idx + 1, title: e.target.value };
                        setDraft({ ...draft, step_by_step_implementation: next });
                      }}
                    />
                    <Input
                      type="number"
                      min={1}
                      className="w-24 text-xs"
                      value={step.estimated_minutes ?? 15}
                      onChange={(e) => {
                        const next = [...draft.step_by_step_implementation];
                        next[idx] = { ...step, estimated_minutes: Number(e.target.value) || 1 };
                        setDraft({ ...draft, step_by_step_implementation: next });
                      }}
                    />
                    <span className="text-xs text-slate-400">min</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Remove step"
                      onClick={() => {
                        const next = draft.step_by_step_implementation
                          .filter((_, sIdx) => sIdx !== idx)
                          .map((s, newIdx) => ({ ...s, step: newIdx + 1 }));
                        setDraft({ ...draft, step_by_step_implementation: next });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-rose-400" />
                    </Button>
                  </div>
                  <Textarea
                    rows={2}
                    value={step.details}
                    onChange={(e) => {
                      const next = [...draft.step_by_step_implementation];
                      next[idx] = { ...step, details: e.target.value };
                      setDraft({ ...draft, step_by_step_implementation: next });
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Algorithm Explanation & Evaluation Methodology</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Algorithm Explanation</label>
                  <Textarea
                    rows={3}
                    value={draft.algorithm_explanation}
                    onChange={(e) => setDraft({ ...draft, algorithm_explanation: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Evaluation Methodology</label>
                  <Textarea
                    rows={3}
                    value={draft.evaluation_methodology}
                    onChange={(e) => setDraft({ ...draft, evaluation_methodology: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expected Results & Possible Challenges</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    Expected Results (Hypothesized / Paper Benchmark)
                  </label>
                  <Textarea
                    rows={3}
                    value={draft.expected_results}
                    onChange={(e) => setDraft({ ...draft, expected_results: e.target.value })}
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs text-slate-400">Possible Challenges</label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() =>
                        setDraft({ ...draft, possible_challenges: [...draft.possible_challenges, ''] })
                      }
                    >
                      <Plus className="h-3 w-3" />
                      Add Challenge
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {draft.possible_challenges.map((c, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <Input
                          value={c}
                          placeholder="Describe challenge..."
                          onChange={(e) => {
                            const next = [...draft.possible_challenges];
                            next[i] = e.target.value;
                            setDraft({ ...draft, possible_challenges: next });
                          }}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label="Remove challenge"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              possible_challenges: draft.possible_challenges.filter((_, idx) => idx !== i),
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
