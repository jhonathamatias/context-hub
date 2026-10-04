import {
  FileState,
  GoogleGenAI,
  type Part,
} from '@google/genai';
import { Service } from 'typedi';
import { env } from '../config/env';
import type { StructuredLessonKnowledge } from '../knowledge/knowledge.schema';
import { withNormalizedProviderErrors } from '../llm/normalize-provider-error';
import {
  hashFileSha256,
  isGeminiFileRefReusable,
  readGeminiFileRef,
  writeGeminiFileRef,
} from './file-ref';
import { multimodalKnowledgeResponseSchema } from './gemini-response-schema';
import {
  resolveGeminiVideoMediaResolution,
  resolveGeminiVideoProcessingMode,
  toMediaProcessing,
  toPartMediaResolutionLevel,
} from './gemini-video-config';
import { mapToStructuredLessonKnowledge } from './map-gemini-video-knowledge';
import { buildMultimodalVideoKnowledgePrompt } from './prompt';
import type { VideoAnalysisInput, VideoKnowledgeProvider } from './types';

const POLL_MS = 2_500;
const MAX_POLL_MS = 15 * 60_000;

/**
 * Gemini Files API + generateContent adapter (@google/genai).
 * Transient 429/503 must bubble to BullMQ — no in-provider sleep retries.
 * Agentic / media-resolution knobs stay inside this adapter only.
 */
@Service()
export class GeminiVideoKnowledgeProvider implements VideoKnowledgeProvider {
  readonly name = 'gemini-video';

  get model(): string {
    return env.gemini.videoModel;
  }

  async analyze(input: VideoAnalysisInput): Promise<StructuredLessonKnowledge> {
    if (!env.gemini.apiKey) {
      const error = new Error('GEMINI_API_KEY is not configured');
      (error as Error & { statusCode?: number }).statusCode = 401;
      throw error;
    }

    const modelName = input.model ?? this.model;
    const processingMode = resolveGeminiVideoProcessingMode(
      env.gemini.videoProcessingMode,
    );
    const mediaResolution = resolveGeminiVideoMediaResolution(
      env.gemini.videoMediaResolution,
    );
    const startedAt = Date.now();

    const client = new GoogleGenAI({ apiKey: env.gemini.apiKey });
    const { fileUri, mimeType, fileReuse } = await this.resolveFileUri(
      client,
      input,
    );

    const resolutionLevel = toPartMediaResolutionLevel(mediaResolution);
    const videoPart: Part = {
      fileData: {
        fileUri,
        mimeType,
      },
      mediaProcessing: toMediaProcessing(processingMode),
      ...(resolutionLevel
        ? { mediaResolution: { level: resolutionLevel } }
        : {}),
    };

    const { text, usage } = await withNormalizedProviderErrors(async () => {
      const result = await client.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [videoPart, { text: buildMultimodalVideoKnowledgePrompt() }],
          },
        ],
        config: {
          temperature: 0.2,
          maxOutputTokens: env.llm.maxOutputTokens,
          responseMimeType: 'application/json',
          responseSchema: multimodalKnowledgeResponseSchema,
        },
      });

      const content = extractResponseText(result);
      if (!content?.trim()) {
        throw new Error('Gemini video analysis returned empty content');
      }

      const meta = result.usageMetadata;
      return {
        text: content,
        usage: {
          inputTokens: meta?.promptTokenCount,
          outputTokens: meta?.candidatesTokenCount,
          totalTokens: meta?.totalTokenCount,
        },
      };
    });

    input.onTelemetry?.({
      provider: this.name,
      model: modelName,
      sourceId: input.sourceId,
      processingMode,
      mediaResolution,
      durationMs: Date.now() - startedAt,
      fileReuse,
      ...(usage.inputTokens != null ? { inputTokens: usage.inputTokens } : {}),
      ...(usage.outputTokens != null
        ? { outputTokens: usage.outputTokens }
        : {}),
      ...(usage.totalTokens != null ? { totalTokens: usage.totalTokens } : {}),
    });

    try {
      return mapToStructuredLessonKnowledge(text);
    } catch (error) {
      const wrapped = new Error(
        error instanceof Error
          ? `Knowledge payload failed schema validation: ${error.message}`
          : 'Knowledge payload failed schema validation',
      );
      (wrapped as Error & { statusCode?: number }).statusCode = 400;
      throw wrapped;
    }
  }

  /**
   * Upload once and reuse the Files API URI across BullMQ retries when the
   * local video hash is unchanged and the remote ref has not expired.
   */
  private async resolveFileUri(
    client: GoogleGenAI,
    input: VideoAnalysisInput,
  ): Promise<{ fileUri: string; mimeType: string; fileReuse: boolean }> {
    const sha = await hashFileSha256(input.videoPath);
    const cached = await readGeminiFileRef(env.storageDir, input.sourceId);

    if (cached && isGeminiFileRefReusable(cached, sha)) {
      try {
        const remote = await client.files.get({ name: cached.fileName });
        if (remote.state === FileState.ACTIVE && remote.uri) {
          return {
            fileUri: remote.uri,
            mimeType: remote.mimeType ?? cached.mimeType,
            fileReuse: true,
          };
        }
      } catch {
        // Re-upload below.
      }
    }

    const uploaded = await client.files.upload({
      file: input.videoPath,
      config: {
        mimeType: input.mimeType,
        displayName: `${input.sourceId}-${input.originalName}`.slice(0, 120),
      },
    });

    if (!uploaded.name) {
      throw new Error('Gemini file upload returned no file name');
    }

    const active = await this.waitUntilActive(client, uploaded.name);
    if (!active.uri) {
      throw new Error(`Gemini file missing uri: ${uploaded.name}`);
    }

    await writeGeminiFileRef(env.storageDir, input.sourceId, {
      fileName: active.name ?? uploaded.name,
      fileUri: active.uri,
      mimeType: active.mimeType ?? input.mimeType,
      contentSha256: sha,
      expiresAt: active.expirationTime ?? null,
    });

    return {
      fileUri: active.uri,
      mimeType: active.mimeType ?? input.mimeType,
      fileReuse: false,
    };
  }

  private async waitUntilActive(client: GoogleGenAI, fileName: string) {
    const started = Date.now();
    for (;;) {
      const file = await client.files.get({ name: fileName });
      if (file.state === FileState.ACTIVE) {
        return file;
      }
      if (file.state === FileState.FAILED) {
        const error = new Error(
          `Gemini file processing failed: ${fileName}`,
        );
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
      }
      if (Date.now() - started > MAX_POLL_MS) {
        const error = new Error(
          `Timed out waiting for Gemini file to become ACTIVE (${fileName})`,
        );
        (error as Error & { statusCode?: number }).statusCode = 503;
        throw error;
      }
      await sleep(POLL_MS);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Prefer SDK text helper; fall back to concatenating candidate parts (agentic). */
function extractResponseText(result: {
  text?: string | undefined;
  candidates?:
    | Array<{
        content?: { parts?: Array<{ text?: string | undefined }> | undefined } | undefined;
      }>
    | undefined;
}): string {
  const direct = result.text?.trim();
  if (direct) return direct;
  const parts = result.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => part.text ?? '')
    .filter(Boolean)
    .join('\n')
    .trim();
}
