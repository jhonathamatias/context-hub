import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVisualEnrichStage1788930000000 implements MigrationInterface {
  name = 'AddVisualEnrichStage1788930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "processing_stage" ADD VALUE IF NOT EXISTS 'VISUAL_ENRICH'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Postgres cannot remove enum values safely; leave VISUAL_ENRICH in place.
  }
}
