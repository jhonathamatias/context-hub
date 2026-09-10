export type TranscriptionSegment = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

export type TranscriptionResult = {
  language: string;
  fullText: string;
  segments: TranscriptionSegment[];
  /** Provider-specific raw payload kept for audit/debug. */
  raw: unknown;
};

export type TranscribeInput = {
  audioPath: string;
  workDir: string;
};

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(input: TranscribeInput): Promise<TranscriptionResult>;
}

/**
 * Future extension point (not implemented): WhisperXTranscriptionProvider
 * for alignment, VAD improvements, and optional diarization — keep
 * TranscriptionProvider as the seam; do not couple callers to faster-whisper.
 */
