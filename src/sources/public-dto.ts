import type { SourceStatus } from '../database/enums';

/** Public response after accepting a video (extract runs in the worker). */
export function toPublicAcceptResult(result: {
  sourceId: string;
  jobId: string;
  connectorKind: string;
  originalName: string;
  status: SourceStatus;
  queuedJob: 'video.extract';
}): {
  sourceId: string;
  jobId: string;
  connectorKind: string;
  originalName: string;
  status: SourceStatus;
  queued: 'video.extract';
} {
  return {
    sourceId: result.sourceId,
    jobId: result.jobId,
    connectorKind: result.connectorKind,
    originalName: result.originalName,
    status: result.status,
    queued: result.queuedJob,
  };
}

export function toPublicQueuedResult(result: {
  sourceId: string;
  queueJobId: string;
  jobName: string;
}): {
  sourceId: string;
  queueJobId: string;
  queued: string;
  status: 'queued';
} {
  return {
    sourceId: result.sourceId,
    queueJobId: result.queueJobId,
    queued: result.jobName,
    status: 'queued',
  };
}
