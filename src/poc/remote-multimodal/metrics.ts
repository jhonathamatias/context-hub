import { clipDurationSeconds, type ClipWindow } from './top3';

export type ClipExtractionMetrics = {
  rank: number;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  outputBytes: number;
  transferredBytes: number | null;
  extractionDurationMs: number;
  outputPath: string;
  usedCopyCodec: boolean;
};

export type RemoteAccessSummary = {
  originalVideoBytes: number;
  transferredBytes: number | null;
  transferRatioPercent: number | null;
  clipOutputBytes: number;
  outputRatioPercent: number;
  totalExtractionDurationMs: number;
  fullDownloadAvoided: 'YES' | 'NO' | 'UNPROVEN';
  remoteSeekResult: 'OK' | 'FAILED' | 'SIMULATED';
  notes: string[];
};

export type TokenAggregate = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  ratioVs384kPercent: number | null;
  ratioVs410kPercent: number | null;
  reductionVs384kPercent: number | null;
};

export function aggregateRemoteAccess(input: {
  originalVideoBytes: number;
  clips: ClipExtractionMetrics[];
  fullDownloadAvoided: RemoteAccessSummary['fullDownloadAvoided'];
  remoteSeekResult: RemoteAccessSummary['remoteSeekResult'];
  notes?: string[];
}): RemoteAccessSummary {
  const clipOutputBytes = input.clips.reduce((s, c) => s + c.outputBytes, 0);
  const transferredKnown = input.clips.every((c) => c.transferredBytes != null);
  const transferredBytes = transferredKnown
    ? input.clips.reduce((s, c) => s + (c.transferredBytes ?? 0), 0)
    : null;
  const totalExtractionDurationMs = input.clips.reduce(
    (s, c) => s + c.extractionDurationMs,
    0,
  );
  const original = Math.max(0, input.originalVideoBytes);

  return {
    originalVideoBytes: original,
    transferredBytes,
    transferRatioPercent:
      transferredBytes != null && original > 0
        ? (transferredBytes / original) * 100
        : null,
    clipOutputBytes,
    outputRatioPercent: original > 0 ? (clipOutputBytes / original) * 100 : 0,
    totalExtractionDurationMs,
    fullDownloadAvoided: input.fullDownloadAvoided,
    remoteSeekResult: input.remoteSeekResult,
    notes: input.notes ?? [],
  };
}

export function aggregateTokens(
  totals: Array<{
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
  }>,
  baseline384k = 384_000,
  baseline410k = 410_000,
): TokenAggregate {
  const hasTotal = totals.every((t) => t.totalTokens != null);
  const hasIn = totals.every((t) => t.inputTokens != null);
  const hasOut = totals.every((t) => t.outputTokens != null);

  const totalTokens = hasTotal
    ? totals.reduce((s, t) => s + (t.totalTokens ?? 0), 0)
    : null;
  const inputTokens = hasIn
    ? totals.reduce((s, t) => s + (t.inputTokens ?? 0), 0)
    : null;
  const outputTokens = hasOut
    ? totals.reduce((s, t) => s + (t.outputTokens ?? 0), 0)
    : null;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    ratioVs384kPercent:
      totalTokens != null ? (totalTokens / baseline384k) * 100 : null,
    ratioVs410kPercent:
      totalTokens != null ? (totalTokens / baseline410k) * 100 : null,
    reductionVs384kPercent:
      totalTokens != null
        ? (1 - totalTokens / baseline384k) * 100
        : null,
  };
}

export function windowsToMetricsStub(windows: ClipWindow[]): Array<{
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
}> {
  return windows.map((w) => ({
    startSeconds: w.startSeconds,
    endSeconds: w.endSeconds,
    durationSeconds: clipDurationSeconds(w),
  }));
}
