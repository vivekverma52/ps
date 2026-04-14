import { MigrationInterface, QueryRunner } from 'typeorm';

export class PrescriptionPerformanceIndexes1700000000006 implements MigrationInterface {
  name = 'PrescriptionPerformanceIndexes1700000000006';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Composite index for org-scoped list queries ordered by newest first.
    // Covers: SELECT ... WHERE org_id = ? ORDER BY created_at DESC
    await queryRunner.query(
      `CREATE INDEX idx_prescriptions_org_created
       ON prescriptions (org_id, created_at)`,
    );

    // Index for doctor-scoped list queries.
    // Covers: SELECT ... WHERE doctor_id = ? ORDER BY created_at DESC
    await queryRunner.query(
      `CREATE INDEX idx_prescriptions_doctor_created
       ON prescriptions (doctor_id, created_at)`,
    );

    // Index for fast OTP token expiry cleanup.
    // Covers: DELETE FROM password_reset_tokens WHERE expires_at < NOW()
    await queryRunner.query(
      `CREATE INDEX idx_password_reset_tokens_expires_at
       ON password_reset_tokens (expires_at)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX idx_prescriptions_org_created ON prescriptions`);
    await queryRunner.query(`DROP INDEX idx_prescriptions_doctor_created ON prescriptions`);
    await queryRunner.query(`DROP INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens`);
  }
}
