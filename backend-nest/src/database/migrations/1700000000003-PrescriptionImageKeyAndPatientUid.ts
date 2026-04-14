import { MigrationInterface, QueryRunner } from 'typeorm';

export class PrescriptionImageKeyAndPatientUid1700000000003 implements MigrationInterface {
  name = 'PrescriptionImageKeyAndPatientUid1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename image_url → image_key (store S3 key, not full URL)
    await queryRunner.query(`
      ALTER TABLE prescriptions
        CHANGE COLUMN image_url image_key VARCHAR(500) NULL,
        CHANGE COLUMN video_url video_key VARCHAR(500) NULL,
        ADD COLUMN patient_uid VARCHAR(255) NULL UNIQUE AFTER id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE prescriptions
        DROP COLUMN patient_uid,
        CHANGE COLUMN image_key image_url VARCHAR(500) NULL,
        CHANGE COLUMN video_key video_url VARCHAR(500) NULL
    `);
  }
}
