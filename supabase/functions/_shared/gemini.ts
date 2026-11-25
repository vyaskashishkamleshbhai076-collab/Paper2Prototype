export interface GeminiOptions {
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}

// Ordered by preference — the first available model wins.
// Override via GEMINI_MODEL env var to pin a specific model.
const FALLBACK_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3-flash-preview',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
];

const MAX_RETRIES = 1;          // per model
const RETRY_DELAY_MS = 800;     // wait between retries on the same model

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Try a single model. Returns the response JSON on success,
 * or throws with the status code attached as `statusCode`.
 */
async function tryModel(
  modelName: string,
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<{ json: Record<string, unknown>; model: string }> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(`Gemini ${modelName} failed (${response.status}): ${errText.slice(0, 300)}`);
    (err as unknown as Record<string, number>).statusCode = response.status;
    throw err;
  }

  const json = await response.json();
  return { json, model: modelName };
}

export async function callGeminiJSON<T>(options: GeminiOptions): Promise<{ data: T; model: string }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured in Supabase Edge Function secrets. Run `supabase secrets set GEMINI_API_KEY=your_key`.'
    );
  }

  // If the user pinned a specific model, put it first; otherwise use the full fallback list.
  const pinnedModel = Deno.env.get('GEMINI_MODEL');
  const modelsToTry = pinnedModel
    ? [pinnedModel, ...FALLBACK_MODELS.filter((m) => m !== pinnedModel)]
    : FALLBACK_MODELS;

  const payload = {
    system_instruction: {
      parts: [{ text: options.systemInstruction }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: options.userPrompt }],
      },
    ],
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxOutputTokens ?? 8192,
      responseMimeType: 'application/json',
    },
  };

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { json, model: usedModel } = await tryModel(model, apiKey, payload);

        // ── extract text from candidates ──
        const candidate = (json as Record<string, unknown>)?.candidates as Array<Record<string, unknown>> | undefined;
        const first = candidate?.[0];
        const parts = (first?.content as Record<string, unknown>)?.parts as Array<{ text?: unknown }> | undefined;
        const rawText = Array.isArray(parts)
          ? parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('').trim()
          : '';

        if (!rawText) {
          const finishReason = first?.finishReason ? ` (finishReason: ${first.finishReason})` : '';
          const emptyErr = new Error(`Gemini API (${usedModel}) returned an empty or malformed response${finishReason}.`);
          (emptyErr as unknown as Record<string, boolean>).fallbackable = true;
          throw emptyErr;
        }

        let parsed: T;
        try {
          parsed = parseStrictJSON<T>(rawText);
        } catch (parseErr) {
          const wrapped = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
          (wrapped as unknown as Record<string, boolean>).fallbackable = true;
          throw wrapped;
        }
        console.log(`[Gemini] Success with model: ${usedModel}` + (attempt > 0 ? ` (retry ${attempt})` : ''));
        return { data: parsed, model: usedModel };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const code = (lastError as unknown as Record<string, number>).statusCode;
        const fallbackable = (lastError as unknown as Record<string, boolean>).fallbackable === true;

        // Retryable: 429 (rate limit), 503 (overloaded), 500 (transient)
        const retryable = code === 429 || code === 503 || code === 500;

        if (retryable && attempt < MAX_RETRIES) {
          console.warn(`[Gemini] ${model} returned ${code}, retrying in ${RETRY_DELAY_MS}ms (attempt ${attempt + 1})…`);
          await sleep(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }

        // 404 means model doesn't exist — skip to next model immediately
        if (code === 404 || fallbackable) {
          console.warn(`[Gemini] ${model} failed (${code ?? 'malformed/empty'}), trying next model…`);
          break;
        }

        // If retries exhausted on a retryable error, try next model
        if (retryable) {
          console.warn(`[Gemini] ${model} still failing after ${MAX_RETRIES} retries, trying next model…`);
          break;
        }

        // Non-retryable error (400, 401, 403, etc.) — throw immediately
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error('All Gemini models failed. Please check your API key and try again.');
}

export function parseStrictJSON<T>(raw: string): T {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Strip markdown fences if model wrapped JSON
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch && fenceMatch[1]) {
      return JSON.parse(fenceMatch[1].trim()) as T;
    }
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as T;
    }
    throw new Error('Failed to parse structured JSON returned by AI model.');
  }
}
