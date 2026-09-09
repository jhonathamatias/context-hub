import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migrates existing camelCase columns to snake_case.
 * Safe to run on databases already created with the previous schema.
 * No-op when columns are already snake_case (fresh installs).
 */
export class RenameColumnsToSnakeCase1788915000000
  implements MigrationInterface
{
  name = 'RenameColumnsToSnakeCase1788915000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'sources' AND column_name = 'originalName'
        ) THEN
          ALTER TABLE "sources" RENAME COLUMN "originalName" TO "original_name";
          ALTER TABLE "sources" RENAME COLUMN "storageKey" TO "storage_key";
          ALTER TABLE "sources" RENAME COLUMN "createdAt" TO "created_at";
          ALTER TABLE "sources" RENAME COLUMN "updatedAt" TO "updated_at";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'processing_jobs' AND column_name = 'sourceId'
        ) THEN
          ALTER TABLE "processing_jobs" RENAME COLUMN "sourceId" TO "source_id";
          ALTER TABLE "processing_jobs" RENAME COLUMN "errorMessage" TO "error_message";
          ALTER TABLE "processing_jobs" RENAME COLUMN "startedAt" TO "started_at";
          ALTER TABLE "processing_jobs" RENAME COLUMN "finishedAt" TO "finished_at";
          ALTER TABLE "processing_jobs" RENAME COLUMN "createdAt" TO "created_at";
          ALTER TABLE "processing_jobs" RENAME COLUMN "updatedAt" TO "updated_at";
        END IF;

        IF EXISTS (
          SELECT 1 FROM pg_class WHERE relname = 'IDX_processing_jobs_sourceId'
        ) THEN
          ALTER INDEX "IDX_processing_jobs_sourceId" RENAME TO "idx_processing_jobs_source_id";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'transcriptions' AND column_name = 'sourceId'
        ) THEN
          ALTER TABLE "transcriptions" RENAME COLUMN "sourceId" TO "source_id";
          ALTER TABLE "transcriptions" RENAME COLUMN "fullText" TO "full_text";
          ALTER TABLE "transcriptions" RENAME COLUMN "segmentsJson" TO "segments_json";
          ALTER TABLE "transcriptions" RENAME COLUMN "rawPath" TO "raw_path";
          ALTER TABLE "transcriptions" RENAME COLUMN "structuredPath" TO "structured_path";
          ALTER TABLE "transcriptions" RENAME COLUMN "errorMessage" TO "error_message";
          ALTER TABLE "transcriptions" RENAME COLUMN "startedAt" TO "started_at";
          ALTER TABLE "transcriptions" RENAME COLUMN "finishedAt" TO "finished_at";
          ALTER TABLE "transcriptions" RENAME COLUMN "createdAt" TO "created_at";
          ALTER TABLE "transcriptions" RENAME COLUMN "updatedAt" TO "updated_at";
        END IF;

        IF EXISTS (
          SELECT 1 FROM pg_class WHERE relname = 'IDX_transcriptions_sourceId'
        ) THEN
          ALTER INDEX "IDX_transcriptions_sourceId" RENAME TO "idx_transcriptions_source_id";
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'transcriptions' AND column_name = 'source_id'
        ) THEN
          ALTER TABLE "transcriptions" RENAME COLUMN "source_id" TO "sourceId";
          ALTER TABLE "transcriptions" RENAME COLUMN "full_text" TO "fullText";
          ALTER TABLE "transcriptions" RENAME COLUMN "segments_json" TO "segmentsJson";
          ALTER TABLE "transcriptions" RENAME COLUMN "raw_path" TO "rawPath";
          ALTER TABLE "transcriptions" RENAME COLUMN "structured_path" TO "structuredPath";
          ALTER TABLE "transcriptions" RENAME COLUMN "error_message" TO "errorMessage";
          ALTER TABLE "transcriptions" RENAME COLUMN "started_at" TO "startedAt";
          ALTER TABLE "transcriptions" RENAME COLUMN "finished_at" TO "finishedAt";
          ALTER TABLE "transcriptions" RENAME COLUMN "created_at" TO "createdAt";
          ALTER TABLE "transcriptions" RENAME COLUMN "updated_at" TO "updatedAt";
        END IF;

        IF EXISTS (
          SELECT 1 FROM pg_class WHERE relname = 'idx_transcriptions_source_id'
        ) THEN
          ALTER INDEX "idx_transcriptions_source_id" RENAME TO "IDX_transcriptions_sourceId";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'processing_jobs' AND column_name = 'source_id'
        ) THEN
          ALTER TABLE "processing_jobs" RENAME COLUMN "source_id" TO "sourceId";
          ALTER TABLE "processing_jobs" RENAME COLUMN "error_message" TO "errorMessage";
          ALTER TABLE "processing_jobs" RENAME COLUMN "started_at" TO "startedAt";
          ALTER TABLE "processing_jobs" RENAME COLUMN "finished_at" TO "finishedAt";
          ALTER TABLE "processing_jobs" RENAME COLUMN "created_at" TO "createdAt";
          ALTER TABLE "processing_jobs" RENAME COLUMN "updated_at" TO "updatedAt";
        END IF;

        IF EXISTS (
          SELECT 1 FROM pg_class WHERE relname = 'idx_processing_jobs_source_id'
        ) THEN
          ALTER INDEX "idx_processing_jobs_source_id" RENAME TO "IDX_processing_jobs_sourceId";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'sources' AND column_name = 'original_name'
        ) THEN
          ALTER TABLE "sources" RENAME COLUMN "original_name" TO "originalName";
          ALTER TABLE "sources" RENAME COLUMN "storage_key" TO "storageKey";
          ALTER TABLE "sources" RENAME COLUMN "created_at" TO "createdAt";
          ALTER TABLE "sources" RENAME COLUMN "updated_at" TO "updatedAt";
        END IF;
      END $$;
    `);
  }
}
