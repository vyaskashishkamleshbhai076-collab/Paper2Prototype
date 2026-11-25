import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { callGeminiJSON } from '../_shared/gemini.ts';
import { assertProjectOwnership, getAuthenticatedClient } from '../_shared/supabaseClient.ts';

interface VerifiedDataset {
  name: string;
  description: string;
  source: string;
  url: string | null;
  verification_status: 'verified' | 'search_link' | 'unverified';
  format: string;
  relevance: string;
}

interface VerifiedLibrary {
  name: string;
  category: string;
  description: string;
  docs_url: string | null;
  verification_status: 'verified' | 'unverified';
  pip_package: string;
}

async function searchHuggingFaceDatasets(query: string): Promise<VerifiedDataset[]> {
  try {
    const url = `https://huggingface.co/api/datasets?search=${encodeURIComponent(query)}&limit=4`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const items = (await res.json()) as Array<{
      id: string;
      description?: string;
      tags?: string[];
    }>;
    return items.map((item) => ({
      name: item.id,
      description: (item.description || 'Community dataset hosted on Hugging Face Hub.').slice(0, 240),
      source: 'Hugging Face Datasets',
      url: `https://huggingface.co/datasets/${item.id}`,
      verification_status: 'verified' as const,
      format: 'Parquet / Arrow / HuggingFace Datasets',
      relevance: `Live Hugging Face Hub match for query "${query}"`,
    }));
  } catch {
    return [];
  }
}

async function verifyPyPIPackage(pkgName: string): Promise<{ exists: boolean; summary?: string; homePage?: string }> {
  const baseName = pkgName.trim().split(/[><=!~\[;\s]/)[0] || '';
  const clean = baseName.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  if (!clean) return { exists: false };
  try {
    const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(clean)}/json`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { exists: false };
    const data = await res.json();
    return {
      exists: true,
      summary: data?.info?.summary,
      homePage: `https://pypi.org/project/${clean}/`,
    };
  } catch {
    return { exists: false };
  }
}

function isPublicHttpUrl(parsed: URL): boolean {
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    host === '0.0.0.0'
  ) {
    return false;
  }
  return true;
}

async function verifyExternalUrl(candidateUrl: string): Promise<boolean> {
  try {
    const parsed = new URL(candidateUrl);
    if (!isPublicHttpUrl(parsed)) return false;
    let res = await fetch(parsed.toString(), { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(4000) });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(parsed.toString(), { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(4000) });
    }
    return res.ok;
  } catch {
    return false;
  }
}

function extractUrlsFromText(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s"'<>)\]]+/gi) || [];
  return Array.from(new Set(matches.map((u) => u.replace(/[.,;:]+$/, ''))));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await getAuthenticatedClient(req);
    const { projectId } = (await req.json()) as { projectId?: string };

    if (!projectId) {
      return errorResponse('projectId is required', 400);
    }

    await assertProjectOwnership(supabase, projectId, user.id);

    const { data: analysis, error: analysisErr } = await supabase
      .from('paper_analyses')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    if (analysisErr || !analysis) {
      return errorResponse('Paper analysis not found. Complete Stage 2 first.', 404);
    }

    const prompt = `Based on this paper analysis, generate search queries and recommend datasets and Python libraries.
CRITICAL RULES:
- DO NOT invent direct dataset URLs! Provide concise search keywords so the backend can query live Hugging Face Hub and construct accurate official search URLs for Kaggle, UCI ML Repository, and Google Dataset Search.
- For official research repositories mentioned in the paper, include them ONLY if explicitly stated in the paper (and mark "mentioned_in_paper": true).
- Return ONLY valid JSON:
{
  "search_queries": ["short 2-4 word search query"],
  "candidate_datasets": [
    {
      "name": "string",
      "description": "string",
      "source": "Kaggle Datasets | UCI Machine Learning Repository | Google Dataset Search | Hugging Face Datasets | Official Research Repository",
      "search_term": "string",
      "format": "string",
      "relevance": "string",
      "mentioned_in_paper": false
    }
  ],
  "recommended_libraries": [
    {
      "name": "string",
      "pip_package": "string",
      "category": "string",
      "description": "string"
    }
  ]
}

PAPER CONTEXT:
Title: ${analysis.research_title}
Problem: ${analysis.research_problem}
Datasets in paper: ${JSON.stringify(analysis.dataset_information)}
Technologies in paper: ${JSON.stringify(analysis.technologies_used)}`;

    const { data: aiRecs } = await callGeminiJSON<{
      search_queries?: string[];
      candidate_datasets?: Array<{
        name: string;
        description: string;
        source: string;
        search_term: string;
        format: string;
        relevance: string;
      }>;
      recommended_libraries?: Array<{
        name: string;
        pip_package: string;
        category: string;
        description: string;
      }>;
    }>({
      systemInstruction:
        'You are a research data curator. Never invent or guess direct URLs. Provide exact search terms and real PyPI package names.',
      userPrompt: prompt,
      temperature: 0.2,
    });

    // 1. Live query Hugging Face API for verified dataset URLs
    const queries = (aiRecs.search_queries || [analysis.research_title]).slice(0, 2);
    const hfResultsNested = await Promise.all(queries.map((q) => searchHuggingFaceDatasets(q)));
    const hfDatasets = hfResultsNested.flat();

    // 1b. Check any repository/dataset URLs explicitly cited in extracted paper text
    const { data: paperRow } = await supabase
      .from('uploaded_papers')
      .select('extracted_pages')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const paperTextCombined = [
      analysis.abstract || '',
      JSON.stringify(analysis.dataset_information || {}),
      JSON.stringify(analysis.source_excerpts || []),
      ...((paperRow?.extracted_pages as Array<{ text?: string }> | null)?.map((p) => p.text || '') || []),
    ].join('\n');

    const citedUrls = extractUrlsFromText(paperTextCombined).slice(0, 5);
    const verifiedOfficialDatasets: VerifiedDataset[] = [];
    await Promise.all(
      citedUrls.map(async (u) => {
        const ok = await verifyExternalUrl(u);
        if (ok) {
          verifiedOfficialDatasets.push({
            name: `Paper-Cited Repository (${new URL(u).hostname})`,
            description: 'Official URL explicitly cited in the uploaded research paper and verified reachable via HTTP check.',
            source: 'Official Research Repository',
            url: u,
            verification_status: 'verified',
            format: 'Repository / Web Resource',
            relevance: 'Directly referenced in the paper text.',
          });
        }
      })
    );

    // 2. Build honest search links for Kaggle, UCI, Google Dataset Search (never fabricated direct URLs)
    const curatedSearchDatasets: VerifiedDataset[] = (aiRecs.candidate_datasets || []).map((d) => {
      const term = encodeURIComponent(d.search_term || d.name);
      let url: string | null = null;
      let status: 'verified' | 'search_link' | 'unverified' = 'search_link';
      const srcLower = (d.source || '').toLowerCase();

      if (srcLower.includes('kaggle')) {
        url = `https://www.kaggle.com/search?q=${term}+in%3Adatasets`;
      } else if (srcLower.includes('uci')) {
        url = `https://archive.ics.uci.edu/datasets?search=${term}`;
      } else if (srcLower.includes('google')) {
        url = `https://datasetsearch.research.google.com/search?query=${term}`;
      } else if (srcLower.includes('hugging')) {
        url = `https://huggingface.co/datasets?search=${term}`;
      } else {
        status = 'unverified';
        url = null;
      }

      return {
        name: d.name,
        description: d.description,
        source: d.source,
        url,
        verification_status: status,
        format: d.format || 'Varies',
        relevance: d.relevance,
      };
    });

    // Deduplicate datasets by name
    const seen = new Set<string>();
    const datasets: VerifiedDataset[] = [];
    for (const ds of [...verifiedOfficialDatasets, ...hfDatasets, ...curatedSearchDatasets]) {
      const key = ds.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        datasets.push(ds);
      }
    }

    // 3. Verify PyPI packages via live PyPI JSON API
    const libraries: VerifiedLibrary[] = await Promise.all(
      (aiRecs.recommended_libraries || []).slice(0, 10).map(async (lib) => {
        const pypi = await verifyPyPIPackage(lib.pip_package || lib.name);
        return {
          name: lib.name,
          pip_package: lib.pip_package || lib.name,
          category: lib.category || 'ML / Scientific Computing',
          description: lib.description || pypi.summary || '',
          docs_url: pypi.exists ? pypi.homePage || null : null,
          verification_status: pypi.exists ? 'verified' : 'unverified',
        };
      })
    );

    await supabase
      .from('paper_analyses')
      .update({
        dataset_recommendations: datasets,
        library_recommendations: libraries,
      })
      .eq('project_id', projectId)
      .eq('user_id', user.id);

    const { data: proj } = await supabase
      .from('research_projects')
      .select('stage_statuses, current_stage')
      .eq('id', projectId)
      .single();

    await supabase
      .from('research_projects')
      .update({
        status: 'resources_ready',
        current_stage: Math.max(proj?.current_stage || 1, 6),
        stage_statuses: {
          ...(proj?.stage_statuses || {}),
          '5': 'completed',
        },
      })
      .eq('id', projectId)
      .eq('user_id', user.id);

    return jsonResponse({ datasets, libraries });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return errorResponse(message, message.toLowerCase().includes('unauthorized') ? 401 : 500);
  }
});
