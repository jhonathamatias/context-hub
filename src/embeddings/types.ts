export type EmbedBatchResult = {
  /** Vectors aligned with the input texts order. */
  vectors: number[][];
  model: string;
  dimension: number;
};

export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  /**
   * Expected output dimension when known ahead of time.
   * Some providers report the real size only after the first response.
   */
  readonly dimension: number | null;
  embed(texts: string[]): Promise<EmbedBatchResult>;
}
