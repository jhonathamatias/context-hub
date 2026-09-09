import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIntegrations1788927000000 implements MigrationInterface {
  name = 'AddIntegrations1788927000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "integration_kind" AS ENUM ('ONEDRIVE')`,
    );
    await queryRunner.query(`
      CREATE TABLE "integrations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "kind" "integration_kind" NOT NULL,
        "name" character varying(256) NOT NULL,
        "access_token" text,
        "metadata" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_integrations" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_integrations_kind" ON "integrations" ("kind")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_integrations_kind"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "integrations"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "integration_kind"`);
  }
}
