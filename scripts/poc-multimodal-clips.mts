/**
 * POC 3 Phase 2 — multimodal on Top 3 clips ONLY. No full-video analysis.
 *
 *   docker compose exec -T node pnpm poc:multimodal-clips <sourceId> [phase1.json]
 *
 * Requires Phase 1 artifact (clips on disk). Uses GEMINI_API_KEY.
 */
import 'reflect-metadata';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Container } from 'typedi';
import { env } from '../src/config/env';
import { DatabaseService } from '../src/database/database.service';
import { Transcription } from '../src/database/entities/transcription.entity';
import { TranscriptionStatus } from '../src/database/enums';
import { aggregateTokens } from '../src/poc/remote-multimodal/metrics';
import { formatPhase2Report } from '../src/poc/remote-multimodal/report';
import {
  joinSegmentText,
  segmentsInWindow,
} from '../src/poc/remote-multimodal/transcript-window';
import { analyzeVisualClip } from '../src/poc/remote-multimodal/visual-clip-analyzer';
import type { VisualClipAnalysisResult } from '../src/poc/remote-multimodal/visual-clip-types';
import type { TranscriptionSegment } from '../src/transcription/types';

type Phase1Artifact = {
  sourceId: string;
  workDir: string;
  clips: Array<{
    rank: number;
    startSeconds: number;
    endSeconds: number;
    outputPath: string;
  }>;
};

async function main(): Promise<void> {
  const sourceId = process.argv[2]?.trim();
  const artifactArg = process.argv[3]?.trim();
  if (!sourceId) {
    console.error(
      'Usage: pnpm poc:multimodal-clips <sourceId> [path/to/phase1.json]',
    );
    process.exit(2);
  }

  if (!env.gemini.apiKey) {
    throw new Error('GEMINI_API_KEY is required for Phase 2');
  }

  const database = Container.get(DatabaseService);
  await database.connect();

  try {
    const artifact = await loadPhase1Artifact(sourceId, artifactArg);
    const segments = await loadWhisperSegments(database, sourceId);

    const clipResults: Array<{
      rank: number;
      startSeconds: number;
      endSeconds: number;
      transcript: string;
      analysis: VisualClipAnalysisResult | null;
      error?: string;
    }> = [];

    const sorted = [...artifact.clips].sort((a, b) => a.rank - b.rank);
    for (let i = 0; i < sorted.length; i++) {
      const clip = sorted[i]!;
      const windowSegs = segmentsInWindow(
        segments,
        clip.startSeconds,
        clip.endSeconds,
      );
      const transcript = joinSegmentText(windowSegs);
      try {
        console.error(
          `Analyzing clip #${clip.rank} ${clip.startSeconds}-${clip.endSeconds}…`,
        );
        const analysis = await analyzeVisualClip({
          clipPath: clip.outputPath,
          clipStartSeconds: clip.startSeconds,
          clipEndSeconds: clip.endSeconds,
          transcriptText: transcript,
          sourceId,
        });
        clipResults.push({
          rank: clip.rank,
          startSeconds: clip.startSeconds,
          endSeconds: clip.endSeconds,
          transcript,
          analysis,
        });
      } catch (error) {
        clipResults.push({
          rank: clip.rank,
          startSeconds: clip.startSeconds,
          endSeconds: clip.endSeconds,
          transcript,
          analysis: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      // Space requests to reduce 503 spikes on free tier.
      if (i < sorted.length - 1) {
        await new Promise((r) => setTimeout(r, 8_000));
      }
    }

    const tokens = aggregateTokens(
      clipResults.map((c) => ({
        inputTokens: c.analysis?.telemetry.inputTokens ?? null,
        outputTokens: c.analysis?.telemetry.outputTokens ?? null,
        totalTokens: c.analysis?.telemetry.totalTokens ?? null,
      })),
    );

    const report = formatPhase2Report({ sourceId, clips: clipResults, tokens });
    console.log(report);

    const outPath = join(artifact.workDir, 'phase2.json');
    await writeFile(
      outPath,
      JSON.stringify(
        { sourceId, clipResults, tokens, createdAt: new Date().toISOString() },
        null,
        2,
      ),
    );
    console.log(`\nArtifact: ${outPath}`);
  } finally {
    await database.disconnect();
  }
}

async function loadPhase1Artifact(
  sourceId: string,
  explicitPath?: string,
): Promise<Phase1Artifact> {
  if (explicitPath) {
    return JSON.parse(await readFile(explicitPath, 'utf8')) as Phase1Artifact;
  }

  const root = join(env.tempDir, 'poc-remote-clips', sourceId);
  const runs = await readdir(root).catch(() => []);
  if (runs.length === 0) {
    throw new Error(
      `No Phase 1 artifacts under ${root}. Run: pnpm poc:remote-clips ${sourceId}`,
    );
  }
  runs.sort();
  const latest = runs[runs.length - 1]!;
  const path = join(root, latest, 'phase1.json');
  return JSON.parse(await readFile(path, 'utf8')) as Phase1Artifact;
}

async function loadWhisperSegments(
  database: DatabaseService,
  sourceId: string,
): Promise<TranscriptionSegment[]> {
  const fromDb = await loadWhisperFromDb(database, sourceId);
  if (fromDb.length) return fromDb;

  const fromFile = await loadWhisperFromStorage(sourceId);
  if (fromFile.length) return fromFile;

  /**
   * Top3 windows are hard-coded from the ranking POC (Talisson).
   * Remote OneDrive source may lack Whisper — allow explicit baseline
   * via POC_WHISPER_SOURCE_ID, else the ranking source.
   */
  const baselineId =
    process.env.POC_WHISPER_SOURCE_ID?.trim() ||
    '5fe720dc-d4a4-42dd-81be-f236a3eea095';
  if (baselineId !== sourceId) {
    console.error(
      `No Whisper for ${sourceId}; using baseline ${baselineId} for Top3 window transcripts`,
    );
    const baselineDb = await loadWhisperFromDb(database, baselineId);
    if (baselineDb.length) return baselineDb;
    const baselineFile = await loadWhisperFromStorage(baselineId);
    if (baselineFile.length) return baselineFile;
  }

  throw new Error(
    `No Whisper segments for ${sourceId}` +
      (baselineId !== sourceId ? ` (nor baseline ${baselineId})` : ''),
  );
}

async function loadWhisperFromDb(
  database: DatabaseService,
  sourceId: string,
): Promise<TranscriptionSegment[]> {
  const row = await database.getRepository(Transcription).findOne({
    where: {
      sourceId,
      status: TranscriptionStatus.COMPLETED,
      provider: 'local-whisper',
    },
    order: { createdAt: 'DESC' },
  });
  if (!row?.segmentsJson?.length) return [];
  return row.segmentsJson.map((s) => ({
    startSeconds: s.startSeconds,
    endSeconds: s.endSeconds,
    text: s.text,
  }));
}

async function loadWhisperFromStorage(
  sourceId: string,
): Promise<TranscriptionSegment[]> {
  const path = join(env.storageDir, 'sources', sourceId, 'transcription.json');
  try {
    const raw = JSON.parse(await readFile(path, 'utf8')) as {
      segments?: TranscriptionSegment[];
    };
    return raw.segments?.length ? raw.segments : [];
  } catch {
    return [];
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
