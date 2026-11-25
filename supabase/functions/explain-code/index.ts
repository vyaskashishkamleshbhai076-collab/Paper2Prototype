import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { callGeminiJSON } from '../_shared/gemini.ts';
import { assertProjectOwnership, getAuthenticatedClient } from '../_shared/supabaseClient.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await getAuthenticatedClient(req);
    const { projectId, filePath, code } = (await req.json()) as {
      projectId?: string;
      filePath?: string;
      code?: string;
    };

    if (!projectId || !code) {
      return errorResponse('projectId and code are required', 400);
    }

    await assertProjectOwnership(supabase, projectId, user.id);

    const prompt = `Explain the following Python source file (${filePath || 'script.py'}) in the context of reproducing a research paper.
Return ONLY valid JSON:
{
  "summary": "string",
  "key_components": [{"name": "string", "purpose": "string", "how_it_maps_to_paper": "string"}],
  "data_flow": "string",
  "potential_pitfalls": ["string"]
}

CODE:
${code.slice(0, 18000)}`;

    const { data } = await callGeminiJSON<Record<string, unknown>>({
      systemInstruction:
        'You are a patient research engineering mentor explaining prototype implementation details clearly. Output strictly valid JSON.',
      userPrompt: prompt,
      temperature: 0.2,
    });

    return jsonResponse({ explanation: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return errorResponse(message, message.toLowerCase().includes('unauthorized') ? 401 : 500);
  }
});
