export enum SourceType {
  VIDEO = 'VIDEO',
}

export enum SourceStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
}

export enum ProcessingStage {
  INGEST = 'INGEST',
  EXTRACT_AUDIO = 'EXTRACT_AUDIO',
  TRANSCRIBE = 'TRANSCRIBE',
  CHUNK = 'CHUNK',
  EXTRACT_KNOWLEDGE = 'EXTRACT_KNOWLEDGE',
  EMBED = 'EMBED',
  INDEX = 'INDEX',
}

export enum ProcessingJobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

export enum TranscriptionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum KnowledgeExtractionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum IntegrationKind {
  ONEDRIVE = 'ONEDRIVE',
}
