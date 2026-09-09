/** Queue job names — payloads carry sourceId references only (no video bytes). */
export const JobName = {
  VideoExtract: 'video.extract',
  TranscriptionRun: 'transcription.run',
  KnowledgeExtract: 'knowledge.extract',
  EmbeddingsGenerate: 'embeddings.generate',
  SourceIndex: 'source.index',
} as const;

export type JobName = (typeof JobName)[keyof typeof JobName];

export type SourceJobPayload = {
  sourceId: string;
};

export const ALL_JOB_NAMES: JobName[] = [
  JobName.VideoExtract,
  JobName.TranscriptionRun,
  JobName.KnowledgeExtract,
  JobName.EmbeddingsGenerate,
  JobName.SourceIndex,
];
