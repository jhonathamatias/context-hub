/** Queue job names — payloads carry sourceId references only (no video bytes). */
export const JobName = {
  SourceIngest: 'source.ingest',
  VideoExtract: 'video.extract',
  TranscriptionRun: 'transcription.run',
  KnowledgeExtract: 'knowledge.extract',
  VisualEnrich: 'visual.enrich',
  MultimodalAnalyze: 'multimodal.analyze',
  EmbeddingsGenerate: 'embeddings.generate',
  SourceIndex: 'source.index',
} as const;

export type JobName = (typeof JobName)[keyof typeof JobName];

export type SourceJobPayload = {
  sourceId: string;
};

export const ALL_JOB_NAMES: JobName[] = [
  JobName.SourceIngest,
  JobName.VideoExtract,
  JobName.TranscriptionRun,
  JobName.KnowledgeExtract,
  JobName.VisualEnrich,
  JobName.MultimodalAnalyze,
  JobName.EmbeddingsGenerate,
  JobName.SourceIndex,
];
