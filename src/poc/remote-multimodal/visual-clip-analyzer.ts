import {
  FileState,
  GoogleGenAI,
  Type,
  type Schema,
} from '@google/genai';
import { env } from '../../config/env';
import { mapAbsoluteRange } from './timestamps';
import type {
  VisualClipAnalysisResult,
  VisualClipKnowledge,
  VisualFinding,
  VisualFindingClassification,
} from './visual-clip-types';

const POLL_MS = 2_000;
const MAX_POLL_MS = 5 * 60_000;

const visualClipSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    losesImportantInfoWithoutVideo: { type: Type.BOOLEAN },
    losesImportantInfoReason: { type: Type.STRING },
    visualFindings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
          description: { type: Type.STRING },
          startSeconds: { type: Type.NUMBER, nullable: true },
          endSeconds: { type: Type.NUMBER, nullable: true },
          confidence: { type: Type.NUMBER, nullable: true },
        },
        required: ['type', 'description'],
      },
    },
  },
  required: [
    'summary',
    'visualFindings',
    'losesImportantInfoWithoutVideo',
    'losesImportantInfoReason',
  ],
};

/**
 * Experimental POC analyzer for short visual clips.
 * Uses Gemini only inside this POC module — not the permanent domain contract.
 * Prompt emphasizes image-dependent information vs speech alone.
 */
export async function analyzeVisualClip(input: {
  clipPath: string;
  clipStartSeconds: number;
  clipEndSeconds: number;
  transcriptText: string;
  sourceId: string;
}): Promise<VisualClipAnalysisResult> {
  if (!env.gemini.apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const model = env.gemini.videoModel;
  const client = new GoogleGenAI({ apiKey: env.gemini.apiKey });
  const started = Date.now();

  const uploaded = await client.files.upload({
    file: input.clipPath,
    config: {
      mimeType: 'video/mp4',
      displayName: `poc-clip-${input.sourceId}-${input.clipStartSeconds}`.slice(
        0,
        120,
      ),
    },
  });
  if (!uploaded.name) {
    throw new Error('Gemini clip upload returned no file name');
  }
  const active = await waitUntilActive(client, uploaded.name);
  if (!active.uri) {
    throw new Error('Gemini clip missing uri');
  }

  const prompt = buildVisualClipPrompt(input.transcriptText);
  const result = await client.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            fileData: {
              fileUri: active.uri,
              mimeType: active.mimeType ?? 'video/mp4',
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      temperature: 0.2,
      maxOutputTokens: Math.min(env.llm.maxOutputTokens, 4096),
      responseMimeType: 'application/json',
      responseSchema: visualClipSchema,
    },
  });

  const text = extractText(result);
  if (!text?.trim()) {
    throw new Error('Visual clip analysis returned empty content');
  }

  const parsed = JSON.parse(text) as {
    summary?: string;
    visualFindings?: Array<{
      type?: string;
      description?: string;
      startSeconds?: number | null;
      endSeconds?: number | null;
      confidence?: number | null;
    }>;
    losesImportantInfoWithoutVideo?: boolean;
    losesImportantInfoReason?: string;
  };

  const findings: VisualFinding[] = (parsed.visualFindings ?? []).map((f) => {
    const abs = mapAbsoluteRange(
      input.clipStartSeconds,
      f.startSeconds,
      f.endSeconds,
    );
    const description = String(f.description ?? '').trim();
    return {
      type: String(f.type ?? 'unknown'),
      description,
      startSeconds: f.startSeconds ?? null,
      endSeconds: f.endSeconds ?? null,
      absoluteStartSeconds: abs.absoluteStart,
      absoluteEndSeconds: abs.absoluteEnd,
      confidence: f.confidence ?? null,
      classification: classifyFinding(description, input.transcriptText),
    };
  });

  const knowledge: VisualClipKnowledge = {
    clipStartSeconds: input.clipStartSeconds,
    clipEndSeconds: input.clipEndSeconds,
    summary: String(parsed.summary ?? '').trim(),
    visualFindings: findings,
    losesImportantInfoWithoutVideo:
      parsed.losesImportantInfoWithoutVideo ?? null,
    losesImportantInfoReason: parsed.losesImportantInfoReason ?? null,
  };

  const meta = result.usageMetadata;

  return {
    knowledge,
    telemetry: {
      provider: 'gemini-video-poc-clip',
      model,
      processingMode: 'static',
      mediaResolution: env.gemini.videoMediaResolution,
      durationMs: Date.now() - started,
      fileReuse: false,
      inputTokens: meta?.promptTokenCount ?? null,
      outputTokens: meta?.candidatesTokenCount ?? null,
      totalTokens: meta?.totalTokenCount ?? null,
    },
  };
}

function buildVisualClipPrompt(transcriptText: string): string {
  return [
    'You analyze a SHORT guitar-lesson video clip (audio + visuals).',
    'Focus on information that DEPENDS ON THE IMAGE and cannot be safely inferred from speech alone.',
    'Look for: fretboard region, shape/diagram, frets, strings, fingering, hand position,',
    'movement/direction on the neck, demonstrated chord/scale/arpeggio/lick shapes.',
    'Do NOT invent frets, fingers, or notes you cannot see confidently.',
    'Return JSON only.',
    'For losesImportantInfoWithoutVideo: true only if omitting the image loses important teaching detail.',
    '',
    'Transcript for this window (may be incomplete/ASR):',
    transcriptText || '(empty)',
  ].join('\n');
}

export function classifyFinding(
  description: string,
  transcriptText: string,
): VisualFindingClassification {
  const d = normalize(description);
  const t = normalize(transcriptText);
  if (!d) return 'UNCERTAIN';
  if (!t) return 'NEW_VISUAL_INFORMATION';

  const specificVisual = [
    'casa',
    'traste',
    'corda',
    'digitacao',
    'dedo',
    'mao',
    'braco',
    'regiao',
    'formato',
    'pestana',
    'fret',
    'string',
    'shape',
  ].some((m) => d.includes(m));
  const hasFretNumber = /\bcasa\s*\d|\b\d+\s*(a|ª)?\s*casa|\bfret\s*\d/.test(
    d,
  );
  const concreteVisual = specificVisual || hasFretNumber;
  const overlap = tokenOverlapRatio(d, t);

  // Near paraphrase of speech without concrete visual detail → not a gain.
  if (overlap >= 0.45 && !concreteVisual) return 'DUPLICATE_OF_TRANSCRIPT';
  if (concreteVisual && overlap < 0.55) return 'NEW_VISUAL_INFORMATION';
  if (overlap >= 0.35) return 'SUPPORTED_BY_TRANSCRIPT';
  if (concreteVisual) return 'NEW_VISUAL_INFORMATION';
  return 'UNCERTAIN';
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenOverlapRatio(a: string, b: string): number {
  const ta = new Set(a.split(' ').filter((w) => w.length > 3));
  const tb = new Set(b.split(' ').filter((w) => w.length > 3));
  if (ta.size === 0) return 0;
  let hit = 0;
  for (const w of ta) if (tb.has(w)) hit += 1;
  return hit / ta.size;
}

function extractText(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const candidate = result as {
    text?: string;
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (typeof candidate.text === 'string' && candidate.text.trim()) {
    return candidate.text;
  }
  const parts = candidate.candidates?.[0]?.content?.parts ?? [];
  const joined = parts
    .map((p) => p.text ?? '')
    .join('')
    .trim();
  return joined || undefined;
}

async function waitUntilActive(
  client: GoogleGenAI,
  fileName: string,
): Promise<{ uri?: string | null; mimeType?: string | null; name?: string }> {
  const started = Date.now();
  for (;;) {
    const file = await client.files.get({ name: fileName });
    if (file.state === FileState.ACTIVE) return file;
    if (file.state === FileState.FAILED) {
      throw new Error(`Gemini clip processing failed: ${fileName}`);
    }
    if (Date.now() - started > MAX_POLL_MS) {
      throw new Error(`Timed out waiting for clip file ACTIVE (${fileName})`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}
