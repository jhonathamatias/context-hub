import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTranscriptions1788912000000 implements MigrationInterface {
  name = 'AddTranscriptions1788912000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "transcription_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')
    `);

    await queryRunner.query(`
      CREATE TABLE "transcriptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "source_id" uuid NOT NULL,
        "provider" character varying(64) NOT NULL,
        "status" "transcription_status" NOT NULL DEFAULT 'PENDING',
        "language" character varying(32),
        "full_text" text,
        "segments_json" jsonb,
        "raw_path" character varying(1024),
        "structured_path" character varying(1024),
        "error_message" text,
        "attempt" integer NOT NULL DEFAULT 1,
        "started_at" TIMESTAMPTZ,
        "finished_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transcriptions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transcriptions_source"
          FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_transcriptions_source_id" ON "transcriptions" ("source_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_transcriptions_source_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "transcriptions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "transcription_status"`);
  }
}
