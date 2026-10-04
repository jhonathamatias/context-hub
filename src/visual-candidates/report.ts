import { formatClock, formatDurationLabel } from './format';
import type {
  RankedVisualCandidate,
  RankingCoverageMetrics,
  VisualCandidate,
  VisualCoverageMetrics,
} from './types';

export function formatVisualCandidatesReport(input: {
  sourceId: string;
  metrics: VisualCoverageMetrics;
  candidates: VisualCandidate[];
  origin?: string;
  rankingMetrics?: RankingCoverageMetrics;
  ranked?: RankedVisualCandidate[];
  topN?: number;
}): string {
  const {
    sourceId,
    metrics,
    candidates,
    origin,
    rankingMetrics,
    ranked,
    topN = 5,
  } = input;

  const lines: string[] = [
    'Visual Candidate Detector + Ranker',
    '',
    `Source: ${sourceId}`,
    `Video duration: ${formatDurationLabel(metrics.videoDurationSeconds)}`,
  ];

  if (origin) {
    lines.push(`Transcript origin: ${origin}`);
  }

  lines.push('', '======== DETECTION ========', '');
  lines.push(`Candidate count: ${metrics.candidateCount}`);
  lines.push(
    `Candidate duration: ${formatDurationLabel(metrics.totalCandidateSeconds)}`,
  );
  lines.push(`Visual coverage: ${metrics.coveragePercent.toFixed(2)}%`);

  if (candidates.length === 0) {
    lines.push('', '(no detection candidates)');
  } else {
    lines.push('', 'Detected candidates:', '');
    candidates.forEach((candidate, index) => {
      lines.push(formatCandidateLine(index + 1, candidate));
      lines.push(
        `   triggers: ${candidate.triggers.map((t) => `"${t}"`).join(', ')}`,
      );
      lines.push('');
    });
  }

  if (rankingMetrics && ranked) {
    lines.push('======== RANKING ========', '');
    lines.push(
      `HIGH: ${rankingMetrics.highCandidateCount} candidates / ${formatDurationLabel(rankingMetrics.highCandidateSeconds)} / ${rankingMetrics.highCoveragePercent.toFixed(2)}%`,
    );
    lines.push(
      `MEDIUM: ${rankingMetrics.mediumCandidateCount} candidates / ${formatDurationLabel(rankingMetrics.mediumCandidateSeconds)} / ${rankingMetrics.mediumCoveragePercent.toFixed(2)}%`,
    );
    lines.push(
      `LOW: ${rankingMetrics.lowCandidateCount} candidates / ${formatDurationLabel(rankingMetrics.lowCandidateSeconds)} / ${rankingMetrics.lowCoveragePercent.toFixed(2)}%`,
    );
    lines.push(
      `REJECTED: ${rankingMetrics.rejectedCandidateCount} candidates / ${formatDurationLabel(rankingMetrics.rejectedCandidateSeconds)}`,
    );
    lines.push(
      `HIGH + MEDIUM: ${rankingMetrics.highMediumCandidateCount} candidates / ${formatDurationLabel(rankingMetrics.highMediumCandidateSeconds)} / ${rankingMetrics.highMediumCoveragePercent.toFixed(2)}%`,
    );

    lines.push('', 'By relevance:', '');
    appendGroup(lines, 'HIGH', ranked.filter((c) => !c.rejected && c.relevance === 'high'));
    appendGroup(lines, 'MEDIUM', ranked.filter((c) => !c.rejected && c.relevance === 'medium'));
    appendGroup(lines, 'LOW', ranked.filter((c) => !c.rejected && c.relevance === 'low'));
    appendGroup(lines, 'REJECTED', ranked.filter((c) => c.rejected));

    const top = ranked.filter((c) => !c.rejected).slice(0, topN);
    lines.push('', `======== TOP ${topN} ========`, '');
    if (top.length === 0) {
      lines.push('(none)');
    } else {
      top.forEach((candidate, index) => {
        const duration = Math.max(
          0,
          candidate.endSeconds - candidate.startSeconds,
        );
        lines.push(
          `${index + 1}. ${formatClock(candidate.startSeconds)} → ${formatClock(candidate.endSeconds)} (${Math.round(duration)}s)`,
        );
        lines.push(
          `   score: ${candidate.score} | relevance: ${candidate.relevance.toUpperCase()}`,
        );
        lines.push(
          `   triggers: ${candidate.triggers.map((t) => `"${t}"`).join(', ')}`,
        );
        lines.push(`   scoreReasons:`);
        for (const reason of candidate.scoreReasons) {
          lines.push(`     - ${reason}`);
        }
        if (candidate.contextSnippet) {
          lines.push(`   context: ${candidate.contextSnippet}`);
        }
        lines.push('');
      });
    }
  }

  return lines.join('\n');
}

function appendGroup(
  lines: string[],
  title: string,
  group: RankedVisualCandidate[],
): void {
  lines.push(`${title} (${group.length}):`);
  if (group.length === 0) {
    lines.push('  (none)');
    lines.push('');
    return;
  }
  for (const candidate of group) {
    const duration = Math.max(
      0,
      candidate.endSeconds - candidate.startSeconds,
    );
    lines.push(
      `  - ${formatClock(candidate.startSeconds)} → ${formatClock(candidate.endSeconds)} (${Math.round(duration)}s) score=${candidate.score}`,
    );
    lines.push(
      `    triggers: ${candidate.triggers.map((t) => `"${t}"`).join(', ')}`,
    );
    if (candidate.rejected && candidate.rejectionReasons.length > 0) {
      lines.push(
        `    rejection: ${candidate.rejectionReasons.join('; ')}`,
      );
    } else {
      lines.push(`    reasons: ${candidate.scoreReasons.join(' | ')}`);
    }
  }
  lines.push('');
}

function formatCandidateLine(
  index: number,
  candidate: VisualCandidate,
): string {
  const duration = Math.max(0, candidate.endSeconds - candidate.startSeconds);
  return `${index}. ${formatClock(candidate.startSeconds)} → ${formatClock(candidate.endSeconds)} (${Math.round(duration)}s)`;
}
