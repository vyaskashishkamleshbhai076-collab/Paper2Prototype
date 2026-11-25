-- Paper2Prototype Initial PostgreSQL Schema & RLS Policies
-- Uses PostgreSQL 13+ built-in gen_random_uuid() (no extension schema search_path dependency)

-- Helper function for updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  institution TEXT,
  role TEXT DEFAULT 'researcher',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. RESEARCH PROJECTS
CREATE TABLE IF NOT EXISTS public.research_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'uploaded', 'analyzed', 'blueprint_ready', 'resources_ready', 'code_ready', 'executed', 'completed', 'error')),
  current_stage INTEGER NOT NULL DEFAULT 1 CHECK (current_stage >= 1 AND current_stage <= 9),
  stage_statuses JSONB NOT NULL DEFAULT '{
    "1": "pending",
    "2": "pending",
    "3": "pending",
    "4": "pending",
    "5": "pending",
    "6": "pending",
    "7": "pending",
    "8": "pending",
    "9": "pending"
  }'::jsonb,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_research_projects_user_id ON public.research_projects(user_id);

ALTER TABLE public.research_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects"
  ON public.research_projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects"
  ON public.research_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON public.research_projects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON public.research_projects FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_research_projects_updated_at
  BEFORE UPDATE ON public.research_projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. UPLOADED PAPERS
CREATE TABLE IF NOT EXISTS public.uploaded_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 0,
  is_scanned BOOLEAN NOT NULL DEFAULT FALSE,
  ocr_applied BOOLEAN NOT NULL DEFAULT FALSE,
  extraction_status TEXT NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'extracted', 'needs_ocr', 'failed')),
  extracted_pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  full_text_length INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_uploaded_papers_project_id ON public.uploaded_papers(project_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_papers_user_id ON public.uploaded_papers(user_id);

ALTER TABLE public.uploaded_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own uploaded papers"
  ON public.uploaded_papers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own uploaded papers"
  ON public.uploaded_papers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own uploaded papers"
  ON public.uploaded_papers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own uploaded papers"
  ON public.uploaded_papers FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_uploaded_papers_updated_at
  BEFORE UPDATE ON public.uploaded_papers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. PAPER ANALYSES
CREATE TABLE IF NOT EXISTS public.paper_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES public.research_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  research_title TEXT NOT NULL,
  abstract TEXT,
  research_problem TEXT,
  research_objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
  research_gap TEXT,
  proposed_solution TEXT,
  methodology JSONB NOT NULL DEFAULT '{}'::jsonb,
  algorithms_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  mathematical_models JSONB NOT NULL DEFAULT '[]'::jsonb,
  technologies_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  dataset_information JSONB NOT NULL DEFAULT '{}'::jsonb,
  evaluation_metrics JSONB NOT NULL DEFAULT '[]'::jsonb,
  limitations JSONB NOT NULL DEFAULT '[]'::jsonb,
  future_scope JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_excerpts JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  reproducibility_assessment JSONB NOT NULL DEFAULT '{}'::jsonb,
  dataset_recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  library_recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_model_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_paper_analyses_project_id ON public.paper_analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_paper_analyses_user_id ON public.paper_analyses(user_id);

ALTER TABLE public.paper_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses"
  ON public.paper_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses"
  ON public.paper_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses"
  ON public.paper_analyses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own analyses"
  ON public.paper_analyses FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_paper_analyses_updated_at
  BEFORE UPDATE ON public.paper_analyses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. EXPERIMENT BLUEPRINTS
CREATE TABLE IF NOT EXISTS public.experiment_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  implementation_level TEXT NOT NULL CHECK (implementation_level IN ('beginner', 'intermediate', 'advanced')),
  experiment_title TEXT NOT NULL,
  experiment_objective TEXT NOT NULL,
  required_software JSONB NOT NULL DEFAULT '[]'::jsonb,
  hardware_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  python_libraries JSONB NOT NULL DEFAULT '[]'::jsonb,
  dataset_requirements TEXT,
  input_specifications TEXT,
  output_specifications TEXT,
  step_by_step_implementation JSONB NOT NULL DEFAULT '[]'::jsonb,
  algorithm_explanation TEXT,
  evaluation_methodology TEXT,
  expected_results TEXT,
  possible_challenges JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimated_complexity TEXT,
  is_selected BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (project_id, implementation_level)
);

CREATE INDEX IF NOT EXISTS idx_experiment_blueprints_project_id ON public.experiment_blueprints(project_id);
CREATE INDEX IF NOT EXISTS idx_experiment_blueprints_user_id ON public.experiment_blueprints(user_id);

ALTER TABLE public.experiment_blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blueprints"
  ON public.experiment_blueprints FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own blueprints"
  ON public.experiment_blueprints FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own blueprints"
  ON public.experiment_blueprints FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own blueprints"
  ON public.experiment_blueprints FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_experiment_blueprints_updated_at
  BEFORE UPDATE ON public.experiment_blueprints
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. GENERATED CODE
CREATE TABLE IF NOT EXISTS public.generated_code (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES public.research_projects(id) ON DELETE CASCADE,
  blueprint_id UUID REFERENCES public.experiment_blueprints(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  implementation_level TEXT NOT NULL DEFAULT 'intermediate',
  files JSONB NOT NULL DEFAULT '[]'::jsonb,
  requirements_txt TEXT NOT NULL DEFAULT '',
  readme_md TEXT NOT NULL DEFAULT '',
  configuration_instructions TEXT,
  sample_input TEXT,
  expected_output_format TEXT,
  simplifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  code_explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_generated_code_project_id ON public.generated_code(project_id);
CREATE INDEX IF NOT EXISTS idx_generated_code_user_id ON public.generated_code(user_id);

ALTER TABLE public.generated_code ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generated code"
  ON public.generated_code FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generated code"
  ON public.generated_code FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generated code"
  ON public.generated_code FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own generated code"
  ON public.generated_code FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_generated_code_updated_at
  BEFORE UPDATE ON public.generated_code
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7. EXPERIMENT RUNS
CREATE TABLE IF NOT EXISTS public.experiment_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  code_id UUID REFERENCES public.generated_code(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'timeout', 'sandbox_not_configured')),
  sandbox_provider TEXT,
  entry_file TEXT NOT NULL DEFAULT 'main.py',
  stdout_log TEXT NOT NULL DEFAULT '',
  stderr_log TEXT NOT NULL DEFAULT '',
  exit_code INTEGER,
  execution_time_ms INTEGER,
  generated_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  resource_limits JSONB NOT NULL DEFAULT '{"cpu_cores": 1, "memory_mb": 512, "timeout_seconds": 60, "network": "disabled"}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_experiment_runs_project_id ON public.experiment_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_experiment_runs_user_id ON public.experiment_runs(user_id);

ALTER TABLE public.experiment_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own runs"
  ON public.experiment_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own runs"
  ON public.experiment_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own runs"
  ON public.experiment_runs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own runs"
  ON public.experiment_runs FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_experiment_runs_updated_at
  BEFORE UPDATE ON public.experiment_runs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 8. EXPERIMENT RESULTS
CREATE TABLE IF NOT EXISTS public.experiment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.experiment_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_actual_execution BOOLEAN NOT NULL DEFAULT TRUE,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  chart_series JSONB NOT NULL DEFAULT '[]'::jsonb,
  paper_comparison JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_experiment_results_project_id ON public.experiment_results(project_id);
CREATE INDEX IF NOT EXISTS idx_experiment_results_user_id ON public.experiment_results(user_id);

ALTER TABLE public.experiment_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own results"
  ON public.experiment_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own results"
  ON public.experiment_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own results"
  ON public.experiment_results FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own results"
  ON public.experiment_results FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_experiment_results_updated_at
  BEFORE UPDATE ON public.experiment_results
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 9. GENERATED REPORTS
CREATE TABLE IF NOT EXISTS public.generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_title TEXT NOT NULL,
  sections JSONB NOT NULL DEFAULT '{}'::jsonb,
  reproducibility_score INTEGER,
  includes_actual_execution BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_generated_reports_project_id ON public.generated_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_user_id ON public.generated_reports(user_id);

ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports"
  ON public.generated_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports"
  ON public.generated_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports"
  ON public.generated_reports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports"
  ON public.generated_reports FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_generated_reports_updated_at
  BEFORE UPDATE ON public.generated_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- STORAGE BUCKET & SECURE POLICIES
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'research-papers',
  'research-papers',
  FALSE,
  52428800, -- 50 MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own research PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'research-papers'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own research PDFs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'research-papers'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own research PDFs"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'research-papers'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own research PDFs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'research-papers'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
