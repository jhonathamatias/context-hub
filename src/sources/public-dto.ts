import type { SourceStatus, TranscriptionStatus } from '../database/enums';
import type { VideoMetadata } from '../video/types';

/** Strip internal filesystem paths from ingest responses. */
export function toPublicIngestResult(result: {
  sourceId: string;
  jobId: string;
  connectorKind: string;
  originalName: string;
  status: SourceStatus;
  metadata: VideoMetadata;
}): {
  sourceId: string;
  jobId: string;
  connectorKind: string;
  originalName: string;
  status: SourceStatus;
  metadata: Omit<VideoMetadata, 'streams'> & {
    streamCount: number;
  };
} {
  return {
    sourceId: result.sourceId,
    jobId: result.jobId,
    connectorKind: result.connectorKind,
    originalName: result.originalName,
    status: result.status,
    metadata: {
      durationSeconds: result.metadata.durationSeconds,
      formatName: result.metadata.formatName,
      sizeBytes: result.metadata.sizeBytes,
      video: result.metadata.video,
      audio: result.metadata.audio,
      streamCount: result.metadata.streams.length,
    },
  };
}

/** Strip raw/structured filesystem paths from transcription responses. */
export function toPublicTranscribeResult(result: {
  transcriptionId: string;
  sourceId: string;
  status: TranscriptionStatus;
  provider: string;
  attempt: number;
  language: string | null;
  fullText: string | null;
  segments: Array<{
    startSeconds: number;
    endSeconds: number;
    text: string;
  }>;
}): {
  transcriptionId: string;
  sourceId: string;
  status: TranscriptionStatus;
  provider: string;
  attempt: number;
  language: string | null;
  fullText: string | null;
  segments: Array<{
    startSeconds: number;
    endSeconds: number;
    text: string;
  }>;
} {
  return {
    transcriptionId: result.transcriptionId,
    sourceId: result.sourceId,
    status: result.status,
    provider: result.provider,
    attempt: result.attempt,
    language: result.language,
    fullText: result.fullText,
    segments: result.segments,
  };
}
