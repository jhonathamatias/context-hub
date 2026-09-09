import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChunkEmbeddings1788921000000 implements MigrationInterface {
  name = 'AddChunkEmbeddings1788921000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "chunk_embeddings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "chunk_id" uuid NOT NULL,
        "source_id" uuid NOT NULL,
        "transcription_id" uuid NOT NULL,
        "provider" character varying(64) NOT NULL,
        "model" character varying(128) NOT NULL,
        "dimension" integer NOT NULL,
        "content_hash" character varying(64) NOT NULL,
        "values" jsonb NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chunk_embeddings_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_chunk_embeddings_chunk_model" UNIQUE ("chunk_id", "model"),
        CONSTRAINT "FK_chunk_embeddings_chunk"
          FOREIGN KEY ("chunk_id") REFERENCES "transcript_chunks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chunk_embeddings_source"
          FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chunk_embeddings_transcription"
          FOREIGN KEY ("transcription_id") REFERENCES "transcriptions"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_chunk_embeddings_source_id"
        ON "chunk_embeddings" ("source_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_chunk_embeddings_transcription_id"
        ON "chunk_embeddings" ("transcription_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_chunk_embeddings_model"
        ON "chunk_embeddings" ("model")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_chunk_embeddings_model"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_chunk_embeddings_transcription_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_chunk_embeddings_source_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "chunk_embeddings"`);
  }
}
