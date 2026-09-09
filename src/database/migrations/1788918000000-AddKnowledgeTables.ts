import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKnowledgeTables1788918000000 implements MigrationInterface {
  name = 'AddKnowledgeTables1788918000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "processing_stage" ADD VALUE IF NOT EXISTS 'CHUNK'
    `);
    await queryRunner.query(`
      ALTER TYPE "processing_stage" ADD VALUE IF NOT EXISTS 'EXTRACT_KNOWLEDGE'
    `);

    await queryRunner.query(`
      CREATE TYPE "knowledge_extraction_status" AS ENUM (
        'PENDING',
        'PROCESSING',
        'COMPLETED',
        'FAILED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "transcript_chunks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "source_id" uuid NOT NULL,
        "transcription_id" uuid NOT NULL,
        "chunk_index" integer NOT NULL,
        "text" text NOT NULL,
        "normalized_text" text NOT NULL,
        "start_seconds" double precision NOT NULL,
        "end_seconds" double precision NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transcript_chunks_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transcript_chunks_source"
          FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transcript_chunks_transcription"
          FOREIGN KEY ("transcription_id") REFERENCES "transcriptions"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_transcript_chunks_source_id"
        ON "transcript_chunks" ("source_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_transcript_chunks_transcription_id"
        ON "transcript_chunks" ("transcription_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "knowledge_extractions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "source_id" uuid NOT NULL,
        "transcription_id" uuid NOT NULL,
        "provider" character varying(64) NOT NULL,
        "status" "knowledge_extraction_status" NOT NULL DEFAULT 'PENDING',
        "suggested_title" character varying(512),
        "summary" text,
        "payload_json" jsonb,
        "error_message" text,
        "attempt" integer NOT NULL DEFAULT 1,
        "started_at" TIMESTAMPTZ,
        "finished_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_extractions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_knowledge_extractions_source"
          FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_knowledge_extractions_transcription"
          FOREIGN KEY ("transcription_id") REFERENCES "transcriptions"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_knowledge_extractions_source_id"
        ON "knowledge_extractions" ("source_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_knowledge_extractions_source_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_extractions"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_transcript_chunks_transcription_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_transcript_chunks_source_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "transcript_chunks"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "knowledge_extraction_status"`,
    );
    // Enum values CHUNK/EXTRACT_KNOWLEDGE cannot be removed safely in Postgres.
  }
}
