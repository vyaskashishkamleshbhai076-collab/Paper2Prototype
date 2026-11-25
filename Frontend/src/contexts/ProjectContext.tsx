import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEMO_PROJECT_BUNDLE } from '@/data/demoProject';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  CodeFile,
  ExperimentBlueprint,
  ExtractedPage,
  GeneratedReport,
  ImplementationLevel,
  ProjectBundle,
  ResearchProject,
  StageStatus,
} from '@/types';
import { useAuth } from './AuthContext';

interface ProjectContextValue {
  projects: ResearchProject[];
  activeProjectId: string | null;
  activeBundle: ProjectBundle | null;
  loadingProjects: boolean;
  loadingBundle: boolean;
  error: string | null;
  setActiveProjectId: (id: string | null) => void;
  openDemoProject: () => void;
  refreshProjects: () => Promise<void>;
  refreshActiveBundle: (projectIdOverride?: string) => Promise<void>;
  createProject: (title: string, description?: string) => Promise<ResearchProject>;
  renameProject: (projectId: string, newTitle: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  savePaperUpload: (params: {
    projectId: string;
    file: File;
    pageCount: number;
    pages: ExtractedPage[];
    isScanned: boolean;
    ocrApplied: boolean;
    onUploadProgress?: (pct: number) => void;
  }) => Promise<void>;
  updateStageStatus: (projectId: string, stage: number, status: StageStatus, nextCurrentStage?: number) => Promise<void>;
  saveBlueprintEdits: (blueprint: ExperimentBlueprint) => Promise<void>;
  selectBlueprintLevel: (projectId: string, level: ImplementationLevel) => Promise<void>;
  saveGeneratedFiles: (codeId: string, files: CodeFile[]) => Promise<void>;
  saveGeneratedReport: (params: {
    projectId: string;
    title: string;
    sections: Record<string, unknown>;
    reproducibilityScore: number | null;
    includesActualExecution: boolean;
  }) => Promise<GeneratedReport | null>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

const ACTIVE_PROJECT_STORAGE_KEY = 'p2p_active_project_id';

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [activeBundle, setActiveBundle] = useState<ProjectBundle | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingBundle, setLoadingBundle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setActiveProjectId = useCallback((id: string | null) => {
    setActiveProjectIdState(id);
    try {
      if (id) localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, id);
      else localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  const openDemoProject = useCallback(() => {
    setActiveProjectId(DEMO_PROJECT_BUNDLE.project.id);
    setActiveBundle(DEMO_PROJECT_BUNDLE);
  }, [setActiveProjectId]);

  const refreshProjects = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setProjects([]);
      return;
    }
    setLoadingProjects(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('research_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (err) throw new Error(err.message);
      setProjects((data || []) as ResearchProject[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  }, [user]);

  const refreshActiveBundle = useCallback(
    async (projectIdOverride?: string) => {
      const targetId = projectIdOverride ?? activeProjectId;
      if (!targetId) {
        setActiveBundle(null);
        return;
      }

      if (targetId === DEMO_PROJECT_BUNDLE.project.id) {
        setActiveBundle(DEMO_PROJECT_BUNDLE);
        return;
      }

      if (!user || !isSupabaseConfigured) {
        if (activeProjectId && activeProjectId !== DEMO_PROJECT_BUNDLE.project.id) {
          setActiveProjectId(null);
        }
        setActiveBundle(null);
        return;
      }

      setLoadingBundle(true);
      setError(null);
      try {
        const [projRes, paperRes, analysisRes, bpRes, codeRes, runsRes, resultsRes, reportsRes] =
          await Promise.all([
            supabase.from('research_projects').select('*').eq('id', targetId).eq('user_id', user.id).single(),
            supabase
              .from('uploaded_papers')
              .select('*')
              .eq('project_id', targetId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase.from('paper_analyses').select('*').eq('project_id', targetId).maybeSingle(),
            supabase
              .from('experiment_blueprints')
              .select('*')
              .eq('project_id', targetId)
              .order('created_at', { ascending: true }),
            supabase.from('generated_code').select('*').eq('project_id', targetId).maybeSingle(),
            supabase
              .from('experiment_runs')
              .select('*')
              .eq('project_id', targetId)
              .order('created_at', { ascending: false }),
            supabase
              .from('experiment_results')
              .select('*')
              .eq('project_id', targetId)
              .order('created_at', { ascending: false }),
            supabase
              .from('generated_reports')
              .select('*')
              .eq('project_id', targetId)
              .order('created_at', { ascending: false }),
          ]);

        if (projRes.error || !projRes.data) {
          setActiveBundle(null);
          setActiveProjectId(null);
          return;
        }

        setActiveBundle({
          project: projRes.data as ResearchProject,
          paper: (paperRes.data as ProjectBundle['paper']) || null,
          analysis: (analysisRes.data as ProjectBundle['analysis']) || null,
          blueprints: (bpRes.data as ProjectBundle['blueprints']) || [],
          generatedCode: (codeRes.data as ProjectBundle['generatedCode']) || null,
          runs: (runsRes.data as ProjectBundle['runs']) || [],
          results: (resultsRes.data as ProjectBundle['results']) || [],
          reports: (reportsRes.data as ProjectBundle['reports']) || [],
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load project workspace');
      } finally {
        setLoadingBundle(false);
      }
    },
    [activeProjectId, user]
  );

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    refreshActiveBundle();
  }, [refreshActiveBundle]);

  const createProject = async (title: string, description?: string): Promise<ResearchProject> => {
    if (!user || !isSupabaseConfigured) {
      throw new Error('Sign in with configured Supabase credentials to create persistent projects.');
    }
    const { data, error: err } = await supabase
      .from('research_projects')
      .insert({
        user_id: user.id,
        title: title.trim() || 'Untitled Research Project',
        description: description || null,
        status: 'created',
        current_stage: 1,
      })
      .select()
      .single();

    if (err || !data) throw new Error(err?.message || 'Failed to create project');
    const created = data as ResearchProject;
    setProjects((prev) => [created, ...prev]);
    setActiveProjectId(created.id);
    setActiveBundle({
      project: created,
      paper: null,
      analysis: null,
      blueprints: [],
      generatedCode: null,
      runs: [],
      results: [],
      reports: [],
    });
    return created;
  };

  const renameProject = async (projectId: string, newTitle: string) => {
    if (!user || !isSupabaseConfigured) throw new Error('Authentication required.');
    const trimmed = newTitle.trim();
    if (!trimmed) throw new Error('Project title cannot be empty.');
    const { error: err } = await supabase
      .from('research_projects')
      .update({ title: trimmed })
      .eq('id', projectId)
      .eq('user_id', user.id);
    if (err) throw new Error(err.message);
    await refreshProjects();
    if (activeProjectId === projectId) await refreshActiveBundle(projectId);
  };

  const deleteProject = async (projectId: string) => {
    if (!user || !isSupabaseConfigured) throw new Error('Authentication required.');
    // Clean up storage objects if any
    const { data: papers } = await supabase
      .from('uploaded_papers')
      .select('storage_path')
      .eq('project_id', projectId)
      .eq('user_id', user.id);

    if (papers && papers.length > 0) {
      const paths = papers.map((p) => p.storage_path).filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from('research-papers').remove(paths);
      }
    }

    const { error: err } = await supabase
      .from('research_projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', user.id);
    if (err) throw new Error(err.message);

    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
      setActiveBundle(null);
    }
  };

  const savePaperUpload: ProjectContextValue['savePaperUpload'] = async ({
    projectId,
    file,
    pageCount,
    pages,
    isScanned,
    ocrApplied,
    onUploadProgress,
  }) => {
    if (!user || !isSupabaseConfigured) throw new Error('Authentication required.');

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${user.id}/${projectId}/${Date.now()}_${sanitizedName}`;

    onUploadProgress?.(25);
    const { error: uploadErr } = await supabase.storage
      .from('research-papers')
      .upload(storagePath, file, { contentType: 'application/pdf', upsert: true });

    if (uploadErr) {
      throw new Error(`Storage upload failed: ${uploadErr.message}`);
    }

    onUploadProgress?.(70);
    const fullTextLength = pages.reduce((acc, p) => acc + p.charCount, 0);
    const extractionStatus = isScanned && !ocrApplied ? 'needs_ocr' : 'extracted';

    const { error: dbErr } = await supabase.from('uploaded_papers').insert({
      project_id: projectId,
      user_id: user.id,
      file_name: file.name,
      file_size: file.size,
      storage_path: storagePath,
      page_count: pageCount,
      is_scanned: isScanned,
      ocr_applied: ocrApplied,
      extraction_status: extractionStatus,
      extracted_pages: pages,
      full_text_length: fullTextLength,
    });

    if (dbErr) throw new Error(`Failed to record uploaded paper: ${dbErr.message}`);

    await updateStageStatus(projectId, 1, 'completed', 2);
    await supabase
      .from('research_projects')
      .update({ status: 'uploaded' })
      .eq('id', projectId)
      .eq('user_id', user.id);

    onUploadProgress?.(100);
    await refreshProjects();
    await refreshActiveBundle(projectId);
  };

  const updateStageStatus = async (
    projectId: string,
    stage: number,
    status: StageStatus,
    nextCurrentStage?: number
  ) => {
    if (!user || !isSupabaseConfigured || projectId === DEMO_PROJECT_BUNDLE.project.id) return;
    const { data: existing } = await supabase
      .from('research_projects')
      .select('stage_statuses, current_stage')
      .eq('id', projectId)
      .single();

    const nextStatuses = {
      ...(existing?.stage_statuses || {}),
      [String(stage)]: status,
    };

    const { error: updateErr } = await supabase
      .from('research_projects')
      .update({
        stage_statuses: nextStatuses,
        current_stage: nextCurrentStage ?? existing?.current_stage ?? stage,
      })
      .eq('id', projectId)
      .eq('user_id', user.id);
    if (updateErr) {
      throw new Error(`Failed to update project stage: ${updateErr.message}`);
    }
  };

  const saveBlueprintEdits = async (blueprint: ExperimentBlueprint) => {
    if (blueprint.project_id === DEMO_PROJECT_BUNDLE.project.id) {
      setActiveBundle((prev) =>
        prev
          ? {
              ...prev,
              blueprints: prev.blueprints.map((b) => (b.id === blueprint.id ? blueprint : b)),
            }
          : prev
      );
      return;
    }
    if (!user || !isSupabaseConfigured) throw new Error('Authentication required.');
    const { error: err } = await supabase
      .from('experiment_blueprints')
      .update({
        experiment_title: blueprint.experiment_title,
        experiment_objective: blueprint.experiment_objective,
        dataset_requirements: blueprint.dataset_requirements,
        input_specifications: blueprint.input_specifications,
        output_specifications: blueprint.output_specifications,
        algorithm_explanation: blueprint.algorithm_explanation,
        evaluation_methodology: blueprint.evaluation_methodology,
        expected_results: blueprint.expected_results,
        estimated_complexity: blueprint.estimated_complexity,
        required_software: blueprint.required_software,
        hardware_requirements: blueprint.hardware_requirements,
        python_libraries: blueprint.python_libraries,
        step_by_step_implementation: blueprint.step_by_step_implementation,
        possible_challenges: blueprint.possible_challenges,
      })
      .eq('id', blueprint.id)
      .eq('user_id', user.id);
    if (err) throw new Error(err.message);
    await refreshActiveBundle(blueprint.project_id);
  };

  const selectBlueprintLevel = async (projectId: string, level: ImplementationLevel) => {
    if (projectId === DEMO_PROJECT_BUNDLE.project.id) {
      setActiveBundle((prev) =>
        prev
          ? {
              ...prev,
              blueprints: prev.blueprints.map((b) => ({
                ...b,
                is_selected: b.implementation_level === level,
              })),
            }
          : prev
      );
      return;
    }
    if (!user || !isSupabaseConfigured) return;
    const { error: deselectErr } = await supabase
      .from('experiment_blueprints')
      .update({ is_selected: false })
      .eq('project_id', projectId)
      .eq('user_id', user.id);
    if (deselectErr) throw new Error(deselectErr.message);

    const { error: selectErr } = await supabase
      .from('experiment_blueprints')
      .update({ is_selected: true })
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .eq('implementation_level', level);
    if (selectErr) throw new Error(selectErr.message);
    await refreshActiveBundle(projectId);
  };

  const saveGeneratedFiles = async (codeId: string, files: CodeFile[]) => {
    if (activeProjectId === DEMO_PROJECT_BUNDLE.project.id) {
      setActiveBundle((prev) =>
        prev && prev.generatedCode ? { ...prev, generatedCode: { ...prev.generatedCode, files } } : prev
      );
      return;
    }
    if (!user || !isSupabaseConfigured) throw new Error('Authentication required.');
    const { error: err } = await supabase
      .from('generated_code')
      .update({ files })
      .eq('id', codeId)
      .eq('user_id', user.id);
    if (err) throw new Error(err.message);
    if (activeProjectId) await refreshActiveBundle(activeProjectId);
  };

  const saveGeneratedReport: ProjectContextValue['saveGeneratedReport'] = async ({
    projectId,
    title,
    sections,
    reproducibilityScore,
    includesActualExecution,
  }) => {
    if (projectId === DEMO_PROJECT_BUNDLE.project.id || !user || !isSupabaseConfigured) {
      return null;
    }
    const { data, error: err } = await supabase
      .from('generated_reports')
      .insert({
        project_id: projectId,
        user_id: user.id,
        report_title: title,
        sections,
        reproducibility_score: reproducibilityScore,
        includes_actual_execution: includesActualExecution,
      })
      .select()
      .single();
    if (err) throw new Error(err.message);

    await updateStageStatus(projectId, 9, 'completed', 9);
    await supabase
      .from('research_projects')
      .update({ status: 'completed' })
      .eq('id', projectId)
      .eq('user_id', user.id);

    await refreshProjects();
    await refreshActiveBundle(projectId);
    return data as GeneratedReport;
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProjectId,
        activeBundle,
        loadingProjects,
        loadingBundle,
        error,
        setActiveProjectId,
        openDemoProject,
        refreshProjects,
        refreshActiveBundle,
        createProject,
        renameProject,
        deleteProject,
        savePaperUpload,
        updateStageStatus,
        saveBlueprintEdits,
        selectBlueprintLevel,
        saveGeneratedFiles,
        saveGeneratedReport,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
