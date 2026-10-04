import { formatClock, formatDurationLabel } from './format';
import type { VisualCandidate, VisualCoverageMetrics } from './types';

export function formatVisualCandidatesReport(input: {
  sourceId: string;
  metrics: VisualCoverageMetrics;
  candidates: VisualCandidate[];
  origin?: string;
}): string {
  const { sourceId, metrics, candidates, origin } = input;
  const lines: string[] = [
    'Visual Candidate Detector',
    '',
    `Source: ${sourceId}`,
    `Video duration: ${formatDurationLabel(metrics.videoDurationSeconds)}`,
  ];

  if (origin) {
    lines.push(`Transcript origin: ${origin}`);
  }

  lines.push('', 'Candidates:', '');

  if (candidates.length === 0) {
    lines.push('(none)');
  } else {
    candidates.forEach((candidate, index) => {
      const duration = Math.max(
        0,
        candidate.endSeconds - candidate.startSeconds,
      );
      lines.push(
        `${index + 1}. ${formatClock(candidate.startSeconds)} → ${formatClock(candidate.endSeconds)} (${Math.round(duration)}s)`,
      );
      const triggerLabel =
        candidate.triggers.length === 1 ? 'trigger' : 'triggers';
      lines.push(
        `   ${triggerLabel}: ${candidate.triggers.map((t) => `"${t}"`).join(', ')}`,
      );
      lines.push(`   reason: ${candidate.reason}`);
      lines.push(`   confidence: ${candidate.confidence.toFixed(2)}`);
      lines.push('');
    });
  }

  lines.push(`Candidate count: ${metrics.candidateCount}`);
  lines.push(
    `Candidate duration: ${formatDurationLabel(metrics.totalCandidateSeconds)}`,
  );
  lines.push(`Visual coverage: ${metrics.coveragePercent.toFixed(2)}%`);

  return lines.join('\n');
}
