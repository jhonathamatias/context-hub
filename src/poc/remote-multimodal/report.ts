import { formatClock, formatDurationLabel } from '../../visual-candidates/format';
import type { HttpRangeProbeResult } from './http-range-probe';
import type {
  ClipExtractionMetrics,
  RemoteAccessSummary,
  TokenAggregate,
} from './metrics';
import type { VisualClipAnalysisResult } from './visual-clip-types';

export function formatPhase1Report(input: {
  sourceId: string;
  summary: RemoteAccessSummary;
  clips: ClipExtractionMetrics[];
  rangeProbe: HttpRangeProbeResult | null;
  onedriveError?: string | null;
}): string {
  const lines: string[] = [
    'POC 3 — Phase 1: Remote clips (NO Gemini)',
    '',
    `Source: ${input.sourceId}`,
    `REMOTE SEEK RESULT: ${input.summary.remoteSeekResult}`,
    `Full download avoided: ${input.summary.fullDownloadAvoided}`,
    '',
    `Original video size: ${input.summary.originalVideoBytes} bytes`,
    `Transferred bytes: ${input.summary.transferredBytes ?? 'NOT MEASURABLE'}`,
    `Transfer ratio: ${
      input.summary.transferRatioPercent != null
        ? `${input.summary.transferRatioPercent.toFixed(2)}%`
        : 'n/a'
    }`,
    `Clip output bytes: ${input.summary.clipOutputBytes}`,
    `Output ratio vs original: ${input.summary.outputRatioPercent.toFixed(3)}%`,
    `Extraction time: ${input.summary.totalExtractionDurationMs} ms`,
    '',
  ];

  if (input.onedriveError) {
    lines.push(`OneDrive error: ${input.onedriveError}`, '');
  }

  if (input.rangeProbe) {
    const p = input.rangeProbe;
    lines.push('HTTP Range evidence:');
    lines.push(`  host: ${p.urlHost} → ${p.finalUrlHost ?? p.urlHost}`);
    lines.push(`  HEAD status: ${p.headStatus}`);
    lines.push(`  Accept-Ranges: ${p.acceptRanges}`);
    lines.push(`  Content-Length: ${p.contentLength}`);
    lines.push(`  Range GET status: ${p.rangeGetStatus}`);
    lines.push(`  Content-Range: ${p.contentRange}`);
    lines.push(`  206 Partial Content: ${p.rangeGetStatus === 206 ? 'YES' : 'NO'}`);
    lines.push(`  supportsPartialContent: ${p.supportsPartialContent}`);
    for (const note of p.notes) lines.push(`  note: ${note}`);
    lines.push('');
  }

  lines.push('Clips:');
  for (const clip of input.clips) {
    lines.push(
      `  #${clip.rank} ${formatClock(clip.startSeconds)} → ${formatClock(clip.endSeconds)} (${clip.durationSeconds}s)`,
    );
    lines.push(`    outputBytes: ${clip.outputBytes}`);
    lines.push(
      `    transferredBytes: ${clip.transferredBytes ?? 'n/a'}`,
    );
    lines.push(`    extractionDurationMs: ${clip.extractionDurationMs}`);
    lines.push(`    codec: ${clip.usedCopyCodec ? 'copy' : 're-encode'}`);
    lines.push(`    path: ${clip.outputPath}`);
  }

  if (input.summary.notes.length) {
    lines.push('', 'Notes:');
    for (const note of input.summary.notes) lines.push(`- ${note}`);
  }

  return lines.join('\n');
}

export function formatPhase2Report(input: {
  sourceId: string;
  clips: Array<{
    rank: number;
    startSeconds: number;
    endSeconds: number;
    transcript: string;
    analysis: VisualClipAnalysisResult | null;
    error?: string;
  }>;
  tokens: TokenAggregate;
}): string {
  const lines: string[] = [
    'POC 3 — Phase 2: Multimodal Top 3 only',
    '',
    `Source: ${input.sourceId}`,
    '',
  ];

  for (const clip of input.clips) {
    lines.push(
      `======== CLIP #${clip.rank} ${formatClock(clip.startSeconds)} → ${formatClock(clip.endSeconds)} ========`,
    );
    lines.push('TRANSCRIPT');
    lines.push(clip.transcript || '(empty)');
    lines.push('');
    if (clip.error || !clip.analysis) {
      lines.push('MULTIMODAL: FAILED');
      lines.push(clip.error ?? 'no analysis');
      lines.push('');
      continue;
    }
    const a = clip.analysis;
    lines.push('MULTIMODAL');
    lines.push(a.knowledge.summary);
    lines.push('');
    lines.push('FINDINGS');
    for (const f of a.knowledge.visualFindings) {
      lines.push(
        `- [${f.classification}] ${f.type}: ${f.description}`,
      );
      if (f.absoluteStartSeconds != null) {
        lines.push(
          `  absolute: ${formatClock(f.absoluteStartSeconds)} → ${
            f.absoluteEndSeconds != null
              ? formatClock(f.absoluteEndSeconds)
              : '?'
          }`,
        );
      }
    }
    lines.push('');
    lines.push(
      `Loses important info without video: ${a.knowledge.losesImportantInfoWithoutVideo}`,
    );
    lines.push(`Reason: ${a.knowledge.losesImportantInfoReason}`);
    lines.push(
      `Tokens: in=${a.telemetry.inputTokens} out=${a.telemetry.outputTokens} total=${a.telemetry.totalTokens}`,
    );
    lines.push(
      `Duration: ${formatDurationLabel(a.telemetry.durationMs / 1000)} (${a.telemetry.durationMs} ms)`,
    );
    lines.push('');
  }

  lines.push('======== GLOBAL TOKENS ========');
  lines.push(`Top3 total tokens: ${input.tokens.totalTokens ?? 'n/a'}`);
  lines.push(
    `vs 384k: ${
      input.tokens.ratioVs384kPercent != null
        ? `${input.tokens.ratioVs384kPercent.toFixed(2)}%`
        : 'n/a'
    }`,
  );
  lines.push(
    `vs 410k: ${
      input.tokens.ratioVs410kPercent != null
        ? `${input.tokens.ratioVs410kPercent.toFixed(2)}%`
        : 'n/a'
    }`,
  );
  lines.push(
    `reduction vs 384k: ${
      input.tokens.reductionVs384kPercent != null
        ? `${input.tokens.reductionVs384kPercent.toFixed(2)}%`
        : 'n/a'
    }`,
  );

  return lines.join('\n');
}
