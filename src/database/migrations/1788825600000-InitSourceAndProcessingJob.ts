import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSourceAndProcessingJob1788825600000
  implements MigrationInterface
{
  name = 'InitSourceAndProcessingJob1788825600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "source_type" AS ENUM ('VIDEO')
    `);
    await queryRunner.query(`
      CREATE TYPE "source_status" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED')
    `);
    await queryRunner.query(`
      CREATE TYPE "processing_stage" AS ENUM ('INGEST', 'EXTRACT_AUDIO', 'TRANSCRIBE', 'EMBED', 'INDEX')
    `);
    await queryRunner.query(`
      CREATE TYPE "processing_job_status" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')
    `);

    await queryRunner.query(`
      CREATE TABLE "sources" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "type" "source_type" NOT NULL,
        "original_name" character varying(512) NOT NULL,
        "storage_key" character varying(1024) NOT NULL,
        "status" "source_status" NOT NULL DEFAULT 'PENDING',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sources_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "processing_jobs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "source_id" uuid NOT NULL,
        "stage" "processing_stage" NOT NULL,
        "status" "processing_job_status" NOT NULL DEFAULT 'PENDING',
        "error_message" text,
        "started_at" TIMESTAMPTZ,
        "finished_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_processing_jobs_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_processing_jobs_source"
          FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_processing_jobs_source_id" ON "processing_jobs" ("source_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_processing_jobs_source_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "processing_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sources"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "processing_job_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "processing_stage"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "source_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "source_type"`);
  }
}
