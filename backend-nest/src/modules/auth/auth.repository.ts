import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool } from 'mysql2/promise';
import { MYSQL_POOL } from '../../database/database.module';

@Injectable()
export class AuthRepository {
  private readonly logger = new Logger(AuthRepository.name);

  constructor(@Inject(MYSQL_POOL) private readonly pool: Pool) {}

  // ── Superadmin ────────────────────────────────────────────────────────

  async findSuperadminByEmail(email: string) {
    this.logger.debug(`[findSuperadminByEmail] email=${email}`);
    const [rows]: any = await this.pool.execute(
      'SELECT * FROM superadmins WHERE email = ?', [email],
    );
    return (rows as any[])[0] ?? null;
  }

  // ── Users ─────────────────────────────────────────────────────────────

  async findUserByEmail(email: string) {
    this.logger.debug(`[findUserByEmail] email=${email}`);
    const [rows]: any = await this.pool.execute(
      `SELECT u.*, r.base_role, r.display_name AS role_display_name
       FROM users u
       LEFT JOIN roles r ON u.custom_role_id = r.id
       WHERE u.email = ?`,
      [email],
    );
    return (rows as any[])[0] ?? null;
  }

  async findUserById(userId: string) {
    this.logger.debug(`[findUserById] userId=${userId}`);
    const [rows]: any = await this.pool.execute(
      `SELECT u.id, u.name, u.email, u.role, u.org_id, u.hospital_id,
              u.first_name, u.last_name, u.phone, u.status,
              u.is_owner, u.is_org_admin, u.custom_role_id, u.created_at,
              r.display_name AS role_display_name, r.base_role, r.color AS role_color, r.permissions
       FROM users u
       LEFT JOIN roles r ON u.custom_role_id = r.id
       WHERE u.id = ?`,
      [userId],
    );
    return (rows as any[])[0] ?? null;
  }

  async findUserByEmailForLock(conn: any, email: string) {
    const [rows]: any = await conn.execute(
      'SELECT id FROM users WHERE email = ? FOR UPDATE', [email],
    );
    return (rows as any[])[0] ?? null;
  }

  async insertOrg(conn: any, id: string, name: string, slug: string) {
    await conn.execute(
      'INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)', [id, name, slug],
    );
  }

  async insertUser(conn: any, params: {
    id: string; name: string; email: string; passwordHash: string;
    firstName: string; lastName: string; role: string;
    orgId: string | null; isOwner: boolean; isOrgAdmin: boolean; customRoleId: string | null;
  }) {
    await conn.execute(
      `INSERT INTO users
         (id, name, email, password_hash, first_name, last_name, role,
          org_id, is_owner, is_org_admin, custom_role_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [params.id, params.name, params.email, params.passwordHash,
       params.firstName, params.lastName, params.role,
       params.orgId, params.isOwner ? 1 : 0, params.isOrgAdmin ? 1 : 0, params.customRoleId],
    );
  }

  async setOrgOwner(conn: any, userId: string, orgId: string) {
    await conn.execute(
      'UPDATE organizations SET owner_id = ? WHERE id = ?', [userId, orgId],
    );
  }

  async insertDoctorProfile(conn: any, id: string, userId: string) {
    await conn.execute(
      'INSERT INTO doctor_profiles (id, user_id, role_id) VALUES (?, ?, ?)', [id, userId, null],
    );
  }

  async insertPharmacistProfile(conn: any, id: string, userId: string) {
    await conn.execute(
      'INSERT INTO pharmacist_profiles (id, user_id, role_id) VALUES (?, ?, ?)', [id, userId, null],
    );
  }

  async updateUserPassword(userId: string, passwordHash: string) {
    this.logger.debug(`[updateUserPassword] userId=${userId}`);
    await this.pool.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId],
    );
  }

  async updateUserPasswordInTx(conn: any, userId: string, passwordHash: string) {
    await conn.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId],
    );
  }

  // ── Refresh tokens ────────────────────────────────────────────────────

  async insertRefreshToken(id: string, userId: string, tokenHash: string, expiresAt: Date) {
    this.logger.debug(`[insertRefreshToken] userId=${userId}`);
    await this.pool.execute(
      'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [id, userId, tokenHash, expiresAt],
    );
  }

  async findRefreshTokenByHash(tokenHash: string) {
    this.logger.debug(`[findRefreshTokenByHash]`);
    const [rows]: any = await this.pool.execute(
      'SELECT * FROM refresh_tokens WHERE token_hash = ? AND expires_at > NOW()', [tokenHash],
    );
    return (rows as any[])[0] ?? null;
  }

  async deleteRefreshTokenById(id: string) {
    this.logger.debug(`[deleteRefreshTokenById] id=${id}`);
    await this.pool.execute('DELETE FROM refresh_tokens WHERE id = ?', [id]);
  }

  async deleteRefreshTokenByHash(tokenHash: string) {
    this.logger.debug(`[deleteRefreshTokenByHash]`);
    await this.pool.execute('DELETE FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);
  }

  async deleteAllRefreshTokensByUser(conn: any, userId: string) {
    await conn.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  }

  // ── Password reset tokens ─────────────────────────────────────────────

  async findPasswordResetToken(email: string, otpHash: string) {
    this.logger.debug(`[findPasswordResetToken] email=${email}`);
    const [rows]: any = await this.pool.execute(
      `SELECT prt.id, prt.user_id FROM password_reset_tokens prt
       INNER JOIN users u ON u.id = prt.user_id
       WHERE u.email = ? AND prt.token_hash = ? AND prt.used_at IS NULL AND prt.expires_at > NOW()`,
      [email, otpHash],
    );
    return (rows as any[])[0] ?? null;
  }

  async findUserForPasswordReset(email: string) {
    this.logger.debug(`[findUserForPasswordReset] email=${email}`);
    const [rows]: any = await this.pool.execute(
      'SELECT id, name FROM users WHERE email = ?', [email],
    );
    return (rows as any[])[0] ?? null;
  }

  async deleteUnusedPasswordResetTokens(userId: string) {
    this.logger.debug(`[deleteUnusedPasswordResetTokens] userId=${userId}`);
    await this.pool.execute(
      'DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL', [userId],
    );
  }

  async insertPasswordResetToken(id: string, userId: string, tokenHash: string, expiresAt: Date) {
    this.logger.debug(`[insertPasswordResetToken] userId=${userId}`);
    await this.pool.execute(
      'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [id, userId, tokenHash, expiresAt],
    );
  }

  async markPasswordResetTokenUsed(conn: any, id: string) {
    await conn.execute(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?', [id],
    );
  }

  // ── Transaction helper ────────────────────────────────────────────────

  async getConnection() {
    return this.pool.getConnection();
  }
}
