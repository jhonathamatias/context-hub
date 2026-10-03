import { JobName } from '../jobs/types';

export type VideoProcessorMode = 'legacy' | 'multimodal';

export function isMultimodalPipeline(mode: VideoProcessorMode): boolean {
  return mode === 'multimodal';
}

/** Pure next-job map for tests and JobDispatcher. */
export function buildPipelineNextJobMap(
  mode: VideoProcessorMode,
): Partial<Record<JobName, JobName>> {
  if (mode === 'multimodal') {
    return {
      [JobName.SourceIngest]: JobName.MultimodalAnalyze,
      [JobName.MultimodalAnalyze]: JobName.EmbeddingsGenerate,
      [JobName.EmbeddingsGenerate]: JobName.SourceIndex,
      [JobName.VideoExtract]: JobName.MultimodalAnalyze,
      [JobName.KnowledgeExtract]: JobName.EmbeddingsGenerate,
    };
  }

  return {
    [JobName.SourceIngest]: JobName.VideoExtract,
    [JobName.VideoExtract]: JobName.TranscriptionRun,
    [JobName.TranscriptionRun]: JobName.KnowledgeExtract,
    [JobName.KnowledgeExtract]: JobName.EmbeddingsGenerate,
    [JobName.EmbeddingsGenerate]: JobName.SourceIndex,
  };
}
