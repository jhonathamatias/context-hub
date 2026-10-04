/**
 * POC CLI — Visual Candidate Detector + Ranker (local heuristics only).
 *
 * Usage:
 *   pnpm poc:visual-candidates <sourceId>
 *
 * Prefer running inside the API container so .env/DB/STORAGE_DIR resolve:
 *   docker compose exec -T node pnpm poc:visual-candidates <sourceId>
 *
 * Does not call Gemini, Whisper, or any paid API.
 */
import 'reflect-metadata';
import { Container } from 'typedi';
import { env } from '../src/config/env';
import { DatabaseService } from '../src/database/database.service';
import {
  HeuristicVisualCandidateDetector,
  RuleBasedVisualCandidateRanker,
  computeRankingCoverageMetrics,
  computeVisualCoverageMetrics,
  formatVisualCandidatesReport,
  loadWhisperTranscription,
  resolveVideoDurationSeconds,
} from '../src/visual-candidates';

async function main(): Promise<void> {
  const sourceId = process.argv[2]?.trim();
  if (!sourceId) {
    console.error('Usage: pnpm poc:visual-candidates <sourceId>');
    process.exit(2);
  }

  const database = Container.get(DatabaseService);
  let connected = false;

  try {
    try {
      await database.connect();
      connected = true;
    } catch (error) {
      console.error(
        'Warning: could not connect to database; will try storage file only.',
      );
      console.error(error instanceof Error ? error.message : error);
    }

    const loaded = await loadWhisperTranscription({
      sourceId,
      storageDir: env.storageDir,
      ...(connected ? { database } : {}),
    });

    const detector = new HeuristicVisualCandidateDetector();
    const candidates = await detector.detect(loaded.segments);
    const videoDurationSeconds = resolveVideoDurationSeconds(loaded.segments);
    const metrics = computeVisualCoverageMetrics(
      candidates,
      videoDurationSeconds,
    );

    const ranker = new RuleBasedVisualCandidateRanker();
    const ranked = await ranker.rank(candidates, loaded.segments);
    const rankingMetrics = computeRankingCoverageMetrics(
      candidates,
      ranked,
      videoDurationSeconds,
    );

    console.log(
      formatVisualCandidatesReport({
        sourceId,
        metrics,
        candidates,
        origin: `${loaded.origin} (${loaded.provider}, ${loaded.segments.length} segments)`,
        rankingMetrics,
        ranked,
        topN: 5,
      }),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    if (connected) {
      await database.disconnect();
    }
  }
}

void main();
