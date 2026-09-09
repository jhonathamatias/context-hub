export type MediaStreamInfo = {
  index: number;
  codecType: string;
  codecName: string;
};

export type VideoTrackInfo = {
  codec: string;
  width: number;
  height: number;
  fps: number | null;
};

export type AudioTrackInfo = {
  codec: string;
  sampleRate: number | null;
  channels: number | null;
};

export type VideoMetadata = {
  durationSeconds: number;
  formatName: string;
  sizeBytes: number;
  video: VideoTrackInfo | null;
  audio: AudioTrackInfo | null;
  streams: MediaStreamInfo[];
};

export type VideoProcessingResult = {
  sourcePath: string;
  audioPath: string;
  metadata: VideoMetadata;
};

export type VideoValidationOptions = {
  maxBytes: number;
  allowedExtensions: string[];
};

export interface VideoProcessor {
  validate(inputPath: string, options: VideoValidationOptions): Promise<void>;
  probe(inputPath: string): Promise<VideoMetadata>;
  extractAudio(inputPath: string, outputAudioPath: string): Promise<string>;
  process(
    inputPath: string,
    workDir: string,
    options: VideoValidationOptions,
  ): Promise<VideoProcessingResult>;
}
