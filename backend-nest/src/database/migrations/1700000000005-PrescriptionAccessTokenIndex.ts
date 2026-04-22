import { MigrationInterface, QueryRunner } from 'typeorm';

export class PrescriptionAccessTokenIndex1700000000005 implements MigrationInterface {
  name = 'PrescriptionAccessTokenIndex1700000000005';

  // prescriptions table no longer exists in MySQL — data lives in MongoDB.
  // This migration is a no-op so it gets recorded and the startup sequence continues.
  async up(_queryRunner: QueryRunner): Promise<void> {}

  async down(_queryRunner: QueryRunner): Promise<void> {}
}
