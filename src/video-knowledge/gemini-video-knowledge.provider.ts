import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  FileState,
  GoogleAIFileManager,
} from '@google/generative-ai/server';
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
import { mapToStructuredLessonKnowledge } from './map-gemini-video-knowledge';
import {
  buildMultimodalVideoKnowledgePrompt,
  multimodalKnowledgeResponseSchema,
} from './prompt';
import type { VideoAnalysisInput, VideoKnowledgeProvider } from './types';

const POLL_MS = 2_500;
const MAX_POLL_MS = 15 * 60_000;

/**
 * Gemini Files API + generateContent adapter.
 * Transient 429/503 must bubble to BullMQ — no in-provider sleep retries.
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
    const fileManager = new GoogleAIFileManager(env.gemini.apiKey);
    const { fileUri, mimeType } = await this.resolveFileUri(
      fileManager,
      input,
    );

    const client = new GoogleGenerativeAI(env.gemini.apiKey);
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: env.llm.maxOutputTokens,
        responseMimeType: 'application/json',
        responseSchema: multimodalKnowledgeResponseSchema,
      },
    });

    const text = await withNormalizedProviderErrors(async () => {
      const result = await model.generateContent([
        {
          fileData: {
            fileUri,
            mimeType,
          },
        },
        { text: buildMultimodalVideoKnowledgePrompt() },
      ]);
      const content = result.response.text();
      if (!content?.trim()) {
        throw new Error('Gemini video analysis returned empty content');
      }
      return content;
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
    fileManager: GoogleAIFileManager,
    input: VideoAnalysisInput,
  ): Promise<{ fileUri: string; mimeType: string }> {
    const sha = await hashFileSha256(input.videoPath);
    const cached = await readGeminiFileRef(env.storageDir, input.sourceId);

    if (cached && isGeminiFileRefReusable(cached, sha)) {
      try {
        const remote = await fileManager.getFile(cached.fileName);
        if (remote.state === FileState.ACTIVE) {
          return { fileUri: remote.uri, mimeType: remote.mimeType };
        }
      } catch {
        // Re-upload below.
      }
    }

    const upload = await fileManager.uploadFile(input.videoPath, {
      mimeType: input.mimeType,
      displayName: `${input.sourceId}-${input.originalName}`.slice(0, 120),
    });

    const active = await this.waitUntilActive(
      fileManager,
      upload.file.name,
    );

    await writeGeminiFileRef(env.storageDir, input.sourceId, {
      fileName: active.name,
      fileUri: active.uri,
      mimeType: active.mimeType,
      contentSha256: sha,
      expiresAt: active.expirationTime ?? null,
    });

    return { fileUri: active.uri, mimeType: active.mimeType };
  }

  private async waitUntilActive(
    fileManager: GoogleAIFileManager,
    fileName: string,
  ) {
    const started = Date.now();
    for (;;) {
      const file = await fileManager.getFile(fileName);
      if (file.state === FileState.ACTIVE) {
        return file;
      }
      if (file.state === FileState.FAILED) {
        const error = new Error(
          `Gemini file processing failed: ${file.error?.message ?? fileName}`,
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
