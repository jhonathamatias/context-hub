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
