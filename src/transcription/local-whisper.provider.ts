import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Service } from 'typedi';
import { env } from '../config/env';
import {
  ProcessCommandError,
  runProcess,
} from '../video/process-runner';
import { normalizeSegments } from './normalize-segments';
import type {
  TranscriptionProvider,
  TranscriptionResult,
  TranscribeInput,
} from './types';

type FasterWhisperOutput = {
  language?: string;
  text?: string;
  segments?: Array<{
    start?: number;
    end?: number;
    text?: string;
  }>;
};

@Service()
export class LocalWhisperTranscriptionProvider implements TranscriptionProvider {
  readonly name = 'local-whisper';

  async transcribe(input: TranscribeInput): Promise<TranscriptionResult> {
    await mkdir(input.workDir, { recursive: true });

    const rawOutputPath = join(input.workDir, 'whisper-raw.json');

    const args = [
      env.whisper.scriptPath,
      '--audio',
      input.audioPath,
      '--model',
      env.whisper.model,
      '--device',
      env.whisper.device,
      '--output',
      rawOutputPath,
    ];
    if (env.whisper.language) {
      args.push('--language', env.whisper.language);
    }
    if (env.whisper.initialPrompt) {
      args.push('--initial_prompt', env.whisper.initialPrompt);
    }

    try {
      await runProcess(env.whisper.pythonPath, args, {
        timeoutMs: env.whisper.timeoutMs,
      });
    } catch (error) {
      if (error instanceof ProcessCommandError) {
        const details = [error.stderr, error.stdout].filter(Boolean).join('\n');
        throw new Error(
          `Local Whisper failed: ${details || error.message}`,
        );
      }
      throw error;
    }

    const rawContent = await readFile(rawOutputPath, 'utf8');
    const raw = JSON.parse(rawContent) as FasterWhisperOutput;
    const segments = normalizeSegments(raw.segments);
    const fullText =
      (raw.text ?? segments.map((segment) => segment.text).join(' ')).trim();

    if (!fullText) {
      throw new Error('Local Whisper returned empty transcription');
    }

    const result: TranscriptionResult = {
      language: raw.language ?? 'unknown',
      fullText,
      segments,
      raw,
    };

    await writeFile(rawOutputPath, JSON.stringify(raw, null, 2), 'utf8');

    return result;
  }
}
