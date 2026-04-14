import { MigrationInterface, QueryRunner } from 'typeorm';

export class PrescriptionAccessTokenIndex1700000000005 implements MigrationInterface {
  name = 'PrescriptionAccessTokenIndex1700000000005';

  async up(queryRunner: QueryRunner): Promise<void> {
    // UNIQUE index ensures no two prescriptions share a public share token.
    // Also speeds up GET /api/prescriptions/public/:token lookups.
    await queryRunner.query(
      `ALTER TABLE prescriptions
       MODIFY COLUMN access_token VARCHAR(64) NOT NULL,
       ADD UNIQUE INDEX uq_prescriptions_access_token (access_token)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE prescriptions
       DROP INDEX uq_prescriptions_access_token`,
    );
  }
}
