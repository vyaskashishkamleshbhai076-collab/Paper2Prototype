export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'error';

export type ProjectStatus =
  | 'created'
  | 'uploaded'
  | 'analyzed'
  | 'blueprint_ready'
  | 'resources_ready'
  | 'code_ready'
  | 'executed'
  | 'completed'
  | 'error';

export interface WorkflowStageMeta {
  stage: number;
  key: string;
  label: string;
  shortLabel: string;
  route: string;
  description: string;
}

export const WORKFLOW_STAGES: WorkflowStageMeta[] = [
  {
    stage: 1,
    key: 'upload',
    label: 'PDF Upload',
    shortLabel: 'Upload',
    route: '/app/upload',
    description: 'Upload academic PDF & extract text by page',
  },
  {
    stage: 2,
    key: 'analysis',
    label: 'Research Paper Analysis',
    shortLabel: 'Analysis',
    route: '/app/analysis',
    description: 'Extract problem, gap, datasets, metrics & citations',
  },
  {
    stage: 3,
    key: 'methodology',
    label: 'Methodology Extraction',
    shortLabel: 'Methodology',
    route: '/app/analysis?tab=methodology',
    description: 'Inspect pipeline steps, algorithms & math models',
  },
  {
    stage: 4,
    key: 'blueprint',
    label: 'Experiment Blueprint',
    shortLabel: 'Blueprint',
    route: '/app/blueprint',
    description: 'Editable Beginner / Intermediate / Advanced plan',
  },
  {
    stage: 5,
    key: 'resources',
    label: 'Dataset & Resources',
    shortLabel: 'Datasets',
    route: '/app/datasets',
    description: 'Verified datasets, libraries & official links',
  },
  {
    stage: 6,
    key: 'code',
    label: 'Python Code Generation',
    shortLabel: 'Code',
    route: '/app/code',
    description: 'Modular starter project in Monaco Editor',
  },
  {
    stage: 7,
    key: 'execution',
    label: 'Experiment Execution',
    shortLabel: 'Execute',
    route: '/app/execute',
    description: 'Isolated sandbox execution & live logs',
  },
  {
    stage: 8,
    key: 'results',
    label: 'Result Analysis',
    shortLabel: 'Results',
    route: '/app/results',
    description: 'Actual metrics, charts & paper comparison',
  },
  {
    stage: 9,
    key: 'report',
    label: 'Final Report',
    shortLabel: 'Report',
    route: '/app/reports',
    description: 'Downloadable PDF report & full project bundle',
  },
];

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  institution: string | null;
  role: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResearchProject {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  current_stage: number;
  stage_statuses: Record<string, StageStatus>;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  charCount: number;
  ocrUsed?: boolean;
}

export interface UploadedPaper {
  id: string;
  project_id: string;
  user_id: string;
  file_name: string;
  file_size: number;
  storage_path: string;
  page_count: number;
  is_scanned: boolean;
  ocr_applied: boolean;
  extraction_status: 'pending' | 'extracted' | 'needs_ocr' | 'failed';
  extracted_pages: ExtractedPage[];
  full_text_length: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineStep {
  step_number: number;
  title: string;
  description: string;
  page_ref?: string;
}

export interface HyperparameterInfo {
  name: string;
  value: string;
  page_ref?: string;
}

export interface AlgorithmInfo {
  name: string;
  purpose: string;
  page_ref?: string;
}

export interface MathModelInfo {
  name: string;
  equation_or_formulation: string;
  explanation: string;
  page_ref?: string;
}

export interface DatasetMentioned {
  name: string;
  description: string;
  size: string;
  split_info: string;
  page_ref?: string;
}

export interface EvaluationMetricInfo {
  metric_name: string;
  reported_value: string;
  context: string;
  page_ref?: string;
}

export interface SourceExcerpt {
  field: string;
  page_number: number;
  excerpt: string;
}

export interface AISuggestion {
  category: string;
  suggestion: string;
  rationale: string;
}

export interface ReproducibilityCriterion {
  criterion: string;
  weight: number;
  available: boolean;
  evidence: string;
}

export interface ReproducibilityAssessment {
  score: number;
  max_score: number;
  disclaimer: string;
  criteria_breakdown: ReproducibilityCriterion[];
  available_information: Array<{ criterion: string; weight: number; evidence: string }>;
  missing_information: Array<{ criterion: string; weight: number; reason: string }>;
  challenges: string[];
  recommendations: string[];
}

export interface DatasetRecommendation {
  name: string;
  description: string;
  source: string;
  url: string | null;
  verification_status: 'verified' | 'search_link' | 'unverified';
  format: string;
  relevance: string;
}

export interface LibraryRecommendation {
  name: string;
  pip_package: string;
  category: string;
  description: string;
  docs_url: string | null;
  verification_status: 'verified' | 'unverified';
}

export interface PaperAnalysis {
  id: string;
  project_id: string;
  user_id: string;
  research_title: string;
  abstract: string;
  research_problem: string;
  research_objectives: string[];
  research_gap: string;
  proposed_solution: string;
  methodology: {
    summary?: string;
    pipeline_steps?: PipelineStep[];
    architecture_details?: string;
    hyperparameters?: HyperparameterInfo[];
    training_configuration?: string;
  };
  algorithms_used: AlgorithmInfo[];
  mathematical_models: MathModelInfo[];
  technologies_used: string[];
  dataset_information: {
    datasets?: DatasetMentioned[];
    preprocessing_steps?: string[];
  };
  evaluation_metrics: EvaluationMetricInfo[];
  limitations: string[];
  future_scope: string[];
  source_excerpts: SourceExcerpt[];
  ai_suggestions: AISuggestion[];
  reproducibility_assessment: ReproducibilityAssessment;
  dataset_recommendations: DatasetRecommendation[];
  library_recommendations: LibraryRecommendation[];
  raw_model_name?: string;
  created_at: string;
  updated_at: string;
}

export type ImplementationLevel = 'beginner' | 'intermediate' | 'advanced';

export interface ExperimentBlueprint {
  id: string;
  project_id: string;
  user_id: string;
  implementation_level: ImplementationLevel;
  experiment_title: string;
  experiment_objective: string;
  required_software: string[];
  hardware_requirements: {
    cpu?: string;
    ram?: string;
    gpu?: string;
    storage?: string;
  };
  python_libraries: Array<{
    name: string;
    version_hint?: string;
    purpose: string;
  }>;
  dataset_requirements: string;
  input_specifications: string;
  output_specifications: string;
  step_by_step_implementation: Array<{
    step: number;
    title: string;
    details: string;
    estimated_minutes?: number;
  }>;
  algorithm_explanation: string;
  evaluation_methodology: string;
  expected_results: string;
  possible_challenges: string[];
  estimated_complexity: string;
  is_selected: boolean;
  created_at: string;
  updated_at: string;
}

export interface CodeFile {
  path: string;
  language: string;
  description?: string;
  content: string;
}

export interface GeneratedCode {
  id: string;
  project_id: string;
  blueprint_id: string | null;
  user_id: string;
  project_name: string;
  implementation_level: ImplementationLevel;
  files: CodeFile[];
  requirements_txt: string;
  readme_md: string;
  configuration_instructions: string;
  sample_input: string;
  expected_output_format: string;
  simplifications: string[];
  code_explanation: string;
  created_at: string;
  updated_at: string;
}

export interface GeneratedArtifact {
  name: string;
  size: number;
  content_base64?: string;
  text_preview?: string | null;
}

export interface ExperimentRun {
  id: string;
  project_id: string;
  code_id: string | null;
  user_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'timeout' | 'sandbox_not_configured';
  sandbox_provider: string | null;
  entry_file: string;
  stdout_log: string;
  stderr_log: string;
  exit_code: number | null;
  execution_time_ms: number | null;
  generated_files: GeneratedArtifact[];
  resource_limits: {
    cpu_cores: number;
    memory_mb: number;
    timeout_seconds: number;
    network: string;
  };
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ExperimentResult {
  id: string;
  project_id: string;
  run_id: string;
  user_id: string;
  is_actual_execution: boolean;
  metrics: Record<string, number | string>;
  chart_series: Array<{ metric: string; actual: number; paper_reported?: number }>;
  paper_comparison: EvaluationMetricInfo[];
  summary: string | null;
  artifacts: GeneratedArtifact[];
  created_at: string;
}

export interface GeneratedReport {
  id: string;
  project_id: string;
  user_id: string;
  report_title: string;
  sections: Record<string, unknown>;
  reproducibility_score: number | null;
  includes_actual_execution: boolean;
  created_at: string;
}

export interface ProjectBundle {
  project: ResearchProject;
  paper: UploadedPaper | null;
  analysis: PaperAnalysis | null;
  blueprints: ExperimentBlueprint[];
  generatedCode: GeneratedCode | null;
  runs: ExperimentRun[];
  results: ExperimentResult[];
  reports: GeneratedReport[];
}
