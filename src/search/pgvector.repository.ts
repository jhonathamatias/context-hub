import { Service } from 'typedi';
import { AppDataSource } from '../database';
import { cosineDistanceToScore, toVectorLiteral } from './vector-format';
import type {
  SemanticSearchHit,
  SemanticSearchQuery,
  VectorRepository,
} from './types';

type SearchRow = {
  embedding_id: string;
  chunk_id: string;
  source_id: string;
  source_name: string;
  transcription_id: string;
  chunk_index: number;
  text: string;
  normalized_text: string;
  start_seconds: number;
  end_seconds: number;
  model: string;
  dimension: number;
  distance: number;
};

@Service()
export class PgVectorRepository implements VectorRepository {
  async syncEmbedding(embeddingId: string, values: number[]): Promise<void> {
    await AppDataSource.query(
      `
        UPDATE "chunk_embeddings"
        SET "embedding" = $1::vector,
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = $2
      `,
      [toVectorLiteral(values), embeddingId],
    );
  }

  async search(query: SemanticSearchQuery): Promise<SemanticSearchHit[]> {
    const limit = Math.min(Math.max(query.limit ?? 8, 1), 50);
    const vectorLiteral = toVectorLiteral(query.queryVector);

    const rows = (await AppDataSource.query(
      `
        SELECT
          ce."id" AS embedding_id,
          ce."chunk_id" AS chunk_id,
          ce."source_id" AS source_id,
          s."original_name" AS source_name,
          ce."transcription_id" AS transcription_id,
          tc."chunk_index" AS chunk_index,
          tc."text" AS text,
          tc."normalized_text" AS normalized_text,
          tc."start_seconds" AS start_seconds,
          tc."end_seconds" AS end_seconds,
          ce."model" AS model,
          ce."dimension" AS dimension,
          (ce."embedding" <=> $1::vector) AS distance
        FROM "chunk_embeddings" ce
        INNER JOIN "transcript_chunks" tc ON tc."id" = ce."chunk_id"
        INNER JOIN "sources" s ON s."id" = ce."source_id"
        WHERE ce."embedding" IS NOT NULL
          AND ce."model" = $2
          AND ($3::uuid IS NULL OR ce."source_id" = $3::uuid)
        ORDER BY ce."embedding" <=> $1::vector
        LIMIT $4
      `,
      [vectorLiteral, query.model, query.sourceId ?? null, limit],
    )) as SearchRow[];

    return rows.map((row) => {
      const distance = Number(row.distance);
      return {
        embeddingId: row.embedding_id,
        chunkId: row.chunk_id,
        sourceId: row.source_id,
        sourceName: row.source_name,
        transcriptionId: row.transcription_id,
        chunkIndex: Number(row.chunk_index),
        text: row.text,
        normalizedText: row.normalized_text,
        startSeconds: Number(row.start_seconds),
        endSeconds: Number(row.end_seconds),
        model: row.model,
        dimension: Number(row.dimension),
        distance,
        score: cosineDistanceToScore(distance),
      };
    });
  }
}
