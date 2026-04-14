import { MigrationInterface, QueryRunner } from 'typeorm';

export class PasswordResetTokens1700000000002 implements MigrationInterface {
  name = 'PasswordResetTokens1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id         VARCHAR(36)  NOT NULL PRIMARY KEY,
        user_id    VARCHAR(36)  NOT NULL,
        token_hash VARCHAR(64)  NOT NULL,
        expires_at DATETIME     NOT NULL,
        used_at    DATETIME     NULL,
        created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_prt_user_id (user_id),
        UNIQUE KEY uq_prt_token_hash (token_hash),
        CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS password_reset_tokens`);
  }
}
