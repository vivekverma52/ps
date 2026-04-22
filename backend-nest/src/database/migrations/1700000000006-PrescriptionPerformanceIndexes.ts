import { MigrationInterface, QueryRunner } from 'typeorm';

export class PrescriptionPerformanceIndexes1700000000006 implements MigrationInterface {
  name = 'PrescriptionPerformanceIndexes1700000000006';

  // prescriptions indexes removed — table lives in MongoDB (Mongoose handles indexes there).
  // password_reset_tokens index: add manually if needed:
  //   CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens (expires_at);
  async up(_queryRunner: QueryRunner): Promise<void> {}

  async down(_queryRunner: QueryRunner): Promise<void> {}
}
