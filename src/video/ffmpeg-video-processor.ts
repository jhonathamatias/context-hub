import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Service } from 'typedi';
import { VideoValidationError, assertVideoFile } from './file-validation';
import { ProcessCommandError, runProcess } from './process-runner';
import type {
  AudioTrackInfo,
  MediaStreamInfo,
  VideoMetadata,
  VideoProcessingResult,
  VideoProcessor,
  VideoTrackInfo,
  VideoValidationOptions,
} from './types';

type FfprobeJson = {
  format?: {
    filename?: string;
    format_name?: string;
    duration?: string;
    size?: string;
  };
  streams?: Array<{
    index?: number;
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    avg_frame_rate?: string;
    r_frame_rate?: string;
    sample_rate?: string;
    channels?: number;
  }>;
};

function parseFrameRate(value: string | undefined): number | null {
  if (!value || value === '0/0') {
    return null;
  }

  const [numeratorRaw, denominatorRaw] = value.split('/');
  const numerator = Number(numeratorRaw);
  const denominator = Number(denominatorRaw ?? '1');

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }

  return Number((numerator / denominator).toFixed(3));
}

@Service()
export class FfmpegVideoProcessor implements VideoProcessor {
  async validate(
    inputPath: string,
    options: VideoValidationOptions,
  ): Promise<void> {
    await assertVideoFile(inputPath, inputPath, options);
  }

  async probe(inputPath: string): Promise<VideoMetadata> {
    let stdout: string;

    try {
      ({ stdout } = await runProcess('ffprobe', [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        inputPath,
      ]));
    } catch (error) {
      if (error instanceof ProcessCommandError) {
        throw new VideoValidationError(
          `Invalid or corrupted video file: ${error.stderr || error.message}`,
        );
      }
      throw error;
    }

    const payload = JSON.parse(stdout) as FfprobeJson;
    const streams = payload.streams ?? [];

    const mediaStreams: MediaStreamInfo[] = streams.map((stream, index) => ({
      index: stream.index ?? index,
      codecType: stream.codec_type ?? 'unknown',
      codecName: stream.codec_name ?? 'unknown',
    }));

    const videoStream = streams.find((stream) => stream.codec_type === 'video');
    const audioStream = streams.find((stream) => stream.codec_type === 'audio');

    const video: VideoTrackInfo | null = videoStream
      ? {
          codec: videoStream.codec_name ?? 'unknown',
          width: videoStream.width ?? 0,
          height: videoStream.height ?? 0,
          fps:
            parseFrameRate(videoStream.avg_frame_rate) ??
            parseFrameRate(videoStream.r_frame_rate),
        }
      : null;

    const audio: AudioTrackInfo | null = audioStream
      ? {
          codec: audioStream.codec_name ?? 'unknown',
          sampleRate: audioStream.sample_rate
            ? Number(audioStream.sample_rate)
            : null,
          channels: audioStream.channels ?? null,
        }
      : null;

    return {
      durationSeconds: Number(payload.format?.duration ?? 0),
      formatName: payload.format?.format_name ?? 'unknown',
      sizeBytes: Number(payload.format?.size ?? 0),
      video,
      audio,
      streams: mediaStreams,
    };
  }

  async extractAudio(
    inputPath: string,
    outputAudioPath: string,
  ): Promise<string> {
    try {
      await runProcess('ffmpeg', [
        '-y',
        '-i',
        inputPath,
        '-vn',
        '-ac',
        '1',
        '-ar',
        '16000',
        '-c:a',
        'pcm_s16le',
        outputAudioPath,
      ]);
    } catch (error) {
      if (error instanceof ProcessCommandError) {
        throw new VideoValidationError(
          `Failed to extract audio from video: ${error.stderr || error.message}`,
        );
      }
      throw error;
    }

    return outputAudioPath;
  }

  async process(
    inputPath: string,
    workDir: string,
    options: VideoValidationOptions,
  ): Promise<VideoProcessingResult> {
    await assertVideoFile(inputPath, inputPath, options);
    await mkdir(workDir, { recursive: true });

    const metadata = await this.probe(inputPath);
    if (!metadata.audio) {
      throw new VideoValidationError('Video has no audio stream to extract');
    }

    const audioPath = join(workDir, 'audio.wav');
    await this.extractAudio(inputPath, audioPath);

    return {
      sourcePath: inputPath,
      audioPath,
      metadata,
    };
  }
}
