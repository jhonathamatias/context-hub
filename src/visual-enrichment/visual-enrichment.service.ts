import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import { Service } from 'typedi';
import { env } from '../config/env';
import { OneDriveVideoConnector } from '../connectors/onedrive.connector';
import {
  DatabaseService,
  KnowledgeExtraction,
  KnowledgeExtractionStatus,
  ProcessingJob,
  ProcessingJobStatus,
  ProcessingStage,
  Source,
  SourceStatus,
  TranscriptChunk,
  Transcription,
  TranscriptionStatus,
} from '../database';
import { IntegrationService } from '../integrations/integration.service';
import {
  structuredLessonKnowledgeSchema,
  type StructuredLessonKnowledge,
} from '../knowledge/knowledge.schema';
import { withProcessingLog } from '../observability';
import { analyzeVisualClip } from '../poc/remote-multimodal/visual-clip-analyzer';
import { extractTop3Clips } from '../poc/remote-multimodal/remote-clip-extractor';
import {
  joinSegmentText,
  segmentsInWindow,
} from '../poc/remote-multimodal/transcript-window';
import type { VisualClipKnowledge } from '../poc/remote-multimodal/visual-clip-types';
import type { TranscriptionSegment } from '../transcription/types';
import {
  HeuristicVisualCandidateDetector,
  RuleBasedVisualCandidateRanker,
} from '../visual-candidates';
import { readIngestOrigin } from './ingest-origin';
import {
  mergeVisualIntoLessonKnowledge,
  visualInsightsToChunkDrafts,
} from './merge-visual-knowledge';
import { selectTopVisualCandidates } from './select-top-candidates';

export type VisualEnrichmentResult = {
  sourceId: string;
  status: 'enriched' | 'skipped' | 'failed';
  selectedCount: number;
  clipsAnalyzed: number;
  warning?: string;
};

/**
 * Hybrid pipeline stage: detect → rank → Top N clips → multimodal → merge.
 * Soft-fails: never destroys completed text knowledge; never throws to kill READY.
 */
@Service()
export class VisualEnrichmentService {
  private readonly detector = new HeuristicVisualCandidateDetector();
  private readonly ranker = new RuleBasedVisualCandidateRanker();

  constructor(
    private readonly database: DatabaseService,
    private readonly oneDrive: OneDriveVideoConnector,
    private readonly integrations: IntegrationService,
  ) {}

  async processSource(
    sourceId: string,
    logger: FastifyBaseLogger,
  ): Promise<VisualEnrichmentResult> {
    const sourceRepo = this.database.getRepository(Source);
    const jobRepo = this.database.getRepository(ProcessingJob);
    const knowledgeRepo = this.database.getRepository(KnowledgeExtraction);
    const transcriptionRepo = this.database.getRepository(Transcription);
    const chunkRepo = this.database.getRepository(TranscriptChunk);

    const source = await sourceRepo.findOne({ where: { id: sourceId } });
    if (!source) {
      const error = new Error(`Source not found: ${sourceId}`);
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }

    const job = jobRepo.create({
      sourceId,
      stage: ProcessingStage.VISUAL_ENRICH,
      status: ProcessingJobStatus.RUNNING,
      startedAt: new Date(),
      finishedAt: null,
      errorMessage: null,
    });
    await jobRepo.save(job);

    const workDir = join(env.tempDir, 'visual-enrich', sourceId, String(Date.now()));

    try {
      const topN = env.visualEnrichTopN;
      if (topN <= 0) {
        job.status = ProcessingJobStatus.SUCCEEDED;
        job.finishedAt = new Date();
        job.errorMessage = 'VISUAL_ENRICH_TOP_N=0; skipped';
        await jobRepo.save(job);
        return { sourceId, status: 'skipped', selectedCount: 0, clipsAnalyzed: 0 };
      }

      if (!env.gemini.apiKey) {
        throw new Error('GEMINI_API_KEY required for visual enrichment');
      }

      // Same Source only — never borrow another lesson's transcript.
      // Prefer Whisper (timed ASR); ignore synthetic multimodal rows.
      const transcription =
        (await transcriptionRepo.findOne({
          where: {
            sourceId,
            status: TranscriptionStatus.COMPLETED,
            provider: 'local-whisper',
          },
          order: { createdAt: 'DESC' },
        })) ??
        (await transcriptionRepo.findOne({
          where: { sourceId, status: TranscriptionStatus.COMPLETED },
          order: { createdAt: 'DESC' },
        }));
      if (!transcription?.segmentsJson?.length) {
        throw new Error(`No completed transcription for source ${sourceId}`);
      }
      if (transcription.provider !== 'local-whisper') {
        throw new Error(
          `Visual enrich requires Whisper for source ${sourceId} (found ${transcription.provider})`,
        );
      }

      const knowledge = await knowledgeRepo.findOne({
        where: { sourceId, status: KnowledgeExtractionStatus.COMPLETED },
        order: { createdAt: 'DESC' },
      });
      if (!knowledge?.payloadJson) {
        job.status = ProcessingJobStatus.SUCCEEDED;
        job.finishedAt = new Date();
        job.errorMessage = 'No completed text knowledge; visual enrich skipped';
        await jobRepo.save(job);
        logger.warn({ sourceId }, 'Visual enrich skipped — no text knowledge');
        return {
          sourceId,
          status: 'skipped',
          selectedCount: 0,
          clipsAnalyzed: 0,
          warning: job.errorMessage ?? undefined,
        };
      }

      const segments: TranscriptionSegment[] = transcription.segmentsJson.map(
        (s) => ({
          startSeconds: s.startSeconds,
          endSeconds: s.endSeconds,
          text: s.text,
        }),
      );

      const result = await withProcessingLog(
        logger,
        ProcessingStage.VISUAL_ENRICH,
        { sourceId, topN },
        async () => {
          const candidates = await this.detector.detect(segments);
          const ranked = await this.ranker.rank(candidates, segments);
          const selected = selectTopVisualCandidates(ranked, topN);

          if (selected.length === 0) {
            return {
              status: 'skipped' as const,
              selectedCount: 0,
              clipsAnalyzed: 0,
              warning: 'No relevant visual candidates',
            };
          }

          const windows = selected.map((c, i) => ({
            rank: i + 1,
            startSeconds: c.startSeconds,
            endSeconds: c.endSeconds,
            score: c.score,
            label: `${c.startSeconds}-${c.endSeconds}`,
          }));

          await mkdir(workDir, { recursive: true });
          const clipSource = await this.resolveClipSource(sourceId, source, logger);
          const extracted = await extractTop3Clips({
            windows,
            workDir,
            source: clipSource,
          });

          const clipKnowledge: VisualClipKnowledge[] = [];
          for (const clip of extracted.clips) {
            const windowSegs = segmentsInWindow(
              segments,
              clip.startSeconds,
              clip.endSeconds,
            );
            const transcriptText = joinSegmentText(windowSegs);
            try {
              const analysis = await analyzeVisualClip({
                clipPath: clip.outputPath,
                clipStartSeconds: clip.startSeconds,
                clipEndSeconds: clip.endSeconds,
                transcriptText,
                sourceId,
              });
              clipKnowledge.push(analysis.knowledge);
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              logger.warn(
                { sourceId, clip: clip.outputPath, err: msg.slice(0, 300) },
                'Clip multimodal failed; continuing other clips',
              );
            }
          }

          if (clipKnowledge.length === 0) {
            return {
              status: 'failed' as const,
              selectedCount: selected.length,
              clipsAnalyzed: 0,
              warning: 'All clip multimodal analyses failed',
            };
          }

          const textKnowledge = structuredLessonKnowledgeSchema.parse(
            knowledge.payloadJson,
          );
          const merged = mergeVisualIntoLessonKnowledge(
            textKnowledge,
            clipKnowledge,
          );
          knowledge.payloadJson = merged as unknown as Record<string, unknown>;
          await knowledgeRepo.save(knowledge);

          const maxIndexRow = await chunkRepo
            .createQueryBuilder('c')
            .select('MAX(c.chunk_index)', 'max')
            .where('c.transcription_id = :tid', { tid: transcription.id })
            .getRawOne<{ max: string | null }>();
          const nextIndex = Number(maxIndexRow?.max ?? -1) + 1;
          const visualChunks = visualInsightsToChunkDrafts(merged, nextIndex);
          if (visualChunks.length > 0) {
            await chunkRepo.save(
              visualChunks.map((draft) =>
                chunkRepo.create({
                  sourceId,
                  transcriptionId: transcription.id,
                  chunkIndex: draft.chunkIndex,
                  text: draft.text,
                  normalizedText: draft.normalizedText,
                  startSeconds: draft.startSeconds,
                  endSeconds: draft.endSeconds,
                }),
              ),
            );
          }

          return {
            status: 'enriched' as const,
            selectedCount: selected.length,
            clipsAnalyzed: clipKnowledge.length,
          };
        },
      );

      job.status =
        result.status === 'failed'
          ? ProcessingJobStatus.FAILED
          : ProcessingJobStatus.SUCCEEDED;
      job.errorMessage = result.warning ?? null;
      job.finishedAt = new Date();
      await jobRepo.save(job);
      source.status = SourceStatus.PROCESSING;
      await sourceRepo.save(source);

      return { sourceId, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(
        { sourceId, err: message.slice(0, 400) },
        'Visual enrichment soft-failed; preserving text knowledge',
      );
      job.status = ProcessingJobStatus.FAILED;
      job.errorMessage = message.slice(0, 2000);
      job.finishedAt = new Date();
      await jobRepo.save(job);
      source.status = SourceStatus.PROCESSING;
      await sourceRepo.save(source);
      return {
        sourceId,
        status: 'failed',
        selectedCount: 0,
        clipsAnalyzed: 0,
        warning: message,
      };
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async resolveClipSource(
    sourceId: string,
    source: Source,
    logger: FastifyBaseLogger,
  ): Promise<
    | { kind: 'remote'; url: string }
    | { kind: 'local-file'; path: string }
  > {
    const localPath = join(env.storageDir, source.storageKey);
    const origin = await readIngestOrigin(sourceId);

    if (origin) {
      try {
        const accessToken = await this.integrations.resolveOneDriveAccessToken();
        if (accessToken) {
          const playback = await this.oneDrive.resolvePlayback({
            shareUrl: origin.shareUrl,
            itemId: origin.itemId,
            accessToken,
          });
          if (playback?.downloadUrl) {
            logger.info(
              { sourceId, host: new URL(playback.downloadUrl).host },
              'Visual enrich using OneDrive remote seek',
            );
            return { kind: 'remote', url: playback.downloadUrl };
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn(
          { sourceId, err: msg.slice(0, 200) },
          'Remote seek unavailable; using local ingested file (not a silent full re-download)',
        );
      }
    }

    logger.info(
      { sourceId },
      'Visual enrich extracting clips from local ingested video',
    );
    return { kind: 'local-file', path: localPath };
  }
}
