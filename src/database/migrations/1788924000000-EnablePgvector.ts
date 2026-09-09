import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EnablePgvector1788924000000 implements MigrationInterface {
  name = 'EnablePgvector1788924000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    await queryRunner.query(`
      ALTER TABLE "chunk_embeddings"
        ADD COLUMN IF NOT EXISTS "embedding" vector
    `);

    // jsonb number arrays serialize as "[1, 2, 3]" which pgvector accepts.
    await queryRunner.query(`
      UPDATE "chunk_embeddings"
      SET "embedding" = ("values"::text)::vector
      WHERE "embedding" IS NULL
        AND "values" IS NOT NULL
        AND jsonb_typeof("values") = 'array'
        AND jsonb_array_length("values") > 0
    `);

    // No ANN index here: Gemini gemini-embedding-001 defaults to 3072 dims,
    // above pgvector HNSW/IVFFlat limits (~2000). Sequential scan is fine for MVP.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chunk_embeddings"
        DROP COLUMN IF EXISTS "embedding"
    `);
    // Extension may still be used elsewhere; leave it installed.
  }
}
