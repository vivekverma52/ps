import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHospitalAdminRole1700000000004 implements MigrationInterface {
  name = 'AddHospitalAdminRole1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add HOSPITAL_ADMIN to the role enum
    await queryRunner.query(`
      ALTER TABLE users
      MODIFY COLUMN role ENUM('ORG_ADMIN','HOSPITAL_ADMIN','DOCTOR','PHARMACIST','SUPERADMIN')
      NOT NULL DEFAULT 'DOCTOR'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert hospital admins back to ORG_ADMIN before removing the enum value
    await queryRunner.query(`
      UPDATE users SET role = 'ORG_ADMIN' WHERE role = 'HOSPITAL_ADMIN'
    `);
    await queryRunner.query(`
      ALTER TABLE users
      MODIFY COLUMN role ENUM('ORG_ADMIN','DOCTOR','PHARMACIST','SUPERADMIN')
      NOT NULL DEFAULT 'DOCTOR'
    `);
  }
}
