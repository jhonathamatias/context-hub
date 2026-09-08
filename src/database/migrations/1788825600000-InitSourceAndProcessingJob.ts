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
        "originalName" character varying(512) NOT NULL,
        "storageKey" character varying(1024) NOT NULL,
        "status" "source_status" NOT NULL DEFAULT 'PENDING',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sources_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "processing_jobs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "sourceId" uuid NOT NULL,
        "stage" "processing_stage" NOT NULL,
        "status" "processing_job_status" NOT NULL DEFAULT 'PENDING',
        "errorMessage" text,
        "startedAt" TIMESTAMPTZ,
        "finishedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_processing_jobs_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_processing_jobs_source"
          FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_processing_jobs_sourceId" ON "processing_jobs" ("sourceId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_processing_jobs_sourceId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "processing_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sources"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "processing_job_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "processing_stage"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "source_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "source_type"`);
  }
}
