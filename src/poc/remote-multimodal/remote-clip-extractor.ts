import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { runProcess } from '../../video/process-runner';
import {
  startByteCountingProxy,
  type ProxySource,
} from './byte-counting-proxy';
import { probeHttpRange, type HttpRangeProbeResult } from './http-range-probe';
import type { ClipExtractionMetrics } from './metrics';
import { clipDurationSeconds, type ClipWindow } from './top3';

export type ExtractTop3Result = {
  clips: ClipExtractionMetrics[];
  rangeProbe: HttpRangeProbeResult | null;
  sourceKind: ProxySource['kind'] | 'direct-local';
  workDir: string;
};

/**
 * Extract Top 3 clips via FFmpeg.
 * When using remote or local-file through the byte-counting proxy, transferred
 * bytes are measured. Direct local path is only for labeled fallback.
 */
export async function extractTop3Clips(input: {
  windows: ClipWindow[];
  workDir: string;
  source: ProxySource | { kind: 'direct-local'; path: string };
  timeoutMs?: number;
}): Promise<ExtractTop3Result> {
  await mkdir(input.workDir, { recursive: true });
  const timeoutMs = input.timeoutMs ?? 10 * 60_000;

  if (input.source.kind === 'direct-local') {
    const clips: ClipExtractionMetrics[] = [];
    for (const window of input.windows) {
      clips.push(
        await extractOne({
          window,
          workDir: input.workDir,
          inputUrl: input.source.path,
          getTransferred: () => null,
          resetTransferred: () => undefined,
          timeoutMs,
        }),
      );
    }
    return {
      clips,
      rangeProbe: null,
      sourceKind: 'direct-local',
      workDir: input.workDir,
    };
  }

  let rangeProbe: HttpRangeProbeResult | null = null;
  if (input.source.kind === 'remote') {
    rangeProbe = await probeHttpRange(input.source.url);
  }

  const proxy = await startByteCountingProxy(input.source);
  try {
    if (input.source.kind === 'local-file') {
      rangeProbe = await probeHttpRange(proxy.url);
    }

    const clips: ClipExtractionMetrics[] = [];
    for (const window of input.windows) {
      proxy.resetTransferredBytes();
      const before = proxy.getTransferredBytes();
      const clip = await extractOne({
        window,
        workDir: input.workDir,
        inputUrl: proxy.url,
        getTransferred: () => proxy.getTransferredBytes() - before,
        resetTransferred: () => proxy.resetTransferredBytes(),
        timeoutMs,
      });
      clips.push(clip);
    }

    return {
      clips,
      rangeProbe,
      sourceKind: input.source.kind,
      workDir: input.workDir,
    };
  } finally {
    await proxy.close();
  }
}

async function extractOne(input: {
  window: ClipWindow;
  workDir: string;
  inputUrl: string;
  getTransferred: () => number | null;
  resetTransferred: () => void;
  timeoutMs: number;
}): Promise<ClipExtractionMetrics> {
  const duration = clipDurationSeconds(input.window);
  const outputPath = join(
    input.workDir,
    `clip-rank${input.window.rank}-${input.window.startSeconds}-${input.window.endSeconds}.mp4`,
  );

  const started = Date.now();
  input.resetTransferred();

  let usedCopyCodec = true;
  try {
    await runProcess(
      'ffmpeg',
      [
        '-y',
        '-ss',
        String(input.window.startSeconds),
        '-i',
        input.inputUrl,
        '-t',
        String(duration),
        '-c',
        'copy',
        '-avoid_negative_ts',
        'make_zero',
        outputPath,
      ],
      { timeoutMs: input.timeoutMs },
    );
  } catch {
    usedCopyCodec = false;
    input.resetTransferred();
    await runProcess(
      'ffmpeg',
      [
        '-y',
        '-ss',
        String(input.window.startSeconds),
        '-i',
        input.inputUrl,
        '-t',
        String(duration),
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '20',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        outputPath,
      ],
      { timeoutMs: input.timeoutMs },
    );
  }

  const extractionDurationMs = Date.now() - started;
  const st = await stat(outputPath);
  const transferred = input.getTransferred();

  return {
    rank: input.window.rank,
    startSeconds: input.window.startSeconds,
    endSeconds: input.window.endSeconds,
    durationSeconds: duration,
    outputBytes: st.size,
    transferredBytes: transferred,
    extractionDurationMs,
    outputPath,
    usedCopyCodec,
  };
}
