import { JobName } from '../jobs/types';

export type VideoProcessorMode = 'legacy' | 'hybrid' | 'multimodal';

export function isMultimodalPipeline(mode: VideoProcessorMode): boolean {
  return mode === 'multimodal';
}

export function isHybridPipeline(mode: VideoProcessorMode): boolean {
  return mode === 'hybrid';
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

  if (mode === 'hybrid') {
    return {
      [JobName.SourceIngest]: JobName.VideoExtract,
      [JobName.VideoExtract]: JobName.TranscriptionRun,
      [JobName.TranscriptionRun]: JobName.KnowledgeExtract,
      [JobName.KnowledgeExtract]: JobName.VisualEnrich,
      [JobName.VisualEnrich]: JobName.EmbeddingsGenerate,
      [JobName.EmbeddingsGenerate]: JobName.SourceIndex,
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
