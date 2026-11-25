import { isSupabaseConfigured, supabase } from './supabase';
import {
  ExperimentBlueprint,
  ExperimentResult,
  ExperimentRun,
  ExtractedPage,
  GeneratedCode,
  ImplementationLevel,
  PaperAnalysis,
  DatasetRecommendation,
  LibraryRecommendation,
} from '@/types';

async function invokeFunction<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env to invoke AI backend functions.'
    );
  }

  const { data, error } = await supabase.functions.invoke<T & { error?: string }>(functionName, {
    body,
  });

  if (error) {
    let detailMessage = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const errJson = await ctx.json();
        if (errJson?.error) detailMessage = errJson.error;
      }
    } catch {
      // keep default error message
    }
    throw new Error(detailMessage || `Edge function ${functionName} failed.`);
  }

  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }

  return data as T;
}

export async function analyzePaperApi(
  projectId: string,
  pages?: ExtractedPage[]
): Promise<{ analysis: PaperAnalysis; sectionsProcessed: number }> {
  return invokeFunction('analyze-paper', { projectId, pages });
}

export async function generateBlueprintApi(
  projectId: string,
  level: ImplementationLevel
): Promise<{ blueprint: ExperimentBlueprint }> {
  return invokeFunction('generate-blueprint', { projectId, level });
}

export async function recommendResourcesApi(projectId: string): Promise<{
  datasets: DatasetRecommendation[];
  libraries: LibraryRecommendation[];
}> {
  return invokeFunction('recommend-resources', { projectId });
}

export async function generateCodeApi(
  projectId: string,
  level?: ImplementationLevel
): Promise<{ generatedCode: GeneratedCode }> {
  return invokeFunction('generate-code', { projectId, level });
}

export async function explainCodeApi(
  projectId: string,
  filePath: string,
  code: string
): Promise<{
  explanation: {
    summary: string;
    key_components: Array<{ name: string; purpose: string; how_it_maps_to_paper: string }>;
    data_flow: string;
    potential_pitfalls: string[];
  };
}> {
  return invokeFunction('explain-code', { projectId, filePath, code });
}

export async function executeExperimentApi(
  projectId: string,
  entryFile = 'main.py',
  customFiles?: Array<{ path: string; content: string }>
): Promise<{
  configured: boolean;
  run: ExperimentRun;
  result?: ExperimentResult | null;
  setupInstructions?: {
    message: string;
    envVars: string[];
    limits: Record<string, unknown>;
  };
}> {
  return invokeFunction('execute-experiment', { projectId, entryFile, customFiles });
}
