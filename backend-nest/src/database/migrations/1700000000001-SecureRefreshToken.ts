import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Security hardening: remove the `token` column from refresh_tokens.
 *
 * Previously the raw JWT was stored alongside its SHA-256 hash.
 * Now only the hash is stored — an attacker who dumps the table cannot
 * reconstruct or replay any session.
 *
 * The `token_hash` column gains a unique index so lookups are O(1)
 * and duplicate inserts are rejected at the DB level.
 */
export class SecureRefreshToken1700000000001 implements MigrationInterface {
  name = 'SecureRefreshToken1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop the raw token column
    await queryRunner.query(
      `ALTER TABLE refresh_tokens DROP COLUMN token`,
    );

    // 2. Add a unique index on token_hash for fast, collision-safe lookups
    await queryRunner.query(
      `ALTER TABLE refresh_tokens
         MODIFY COLUMN token_hash VARCHAR(64) NOT NULL,
         ADD UNIQUE INDEX uq_refresh_tokens_hash (token_hash)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE refresh_tokens DROP INDEX uq_refresh_tokens_hash`,
    );
    await queryRunner.query(
      `ALTER TABLE refresh_tokens
         MODIFY COLUMN token_hash VARCHAR(64) NULL,
         ADD COLUMN token TEXT NULL AFTER user_id`,
    );
  }
}
