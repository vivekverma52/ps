import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'mysql2/promise';
import { MYSQL_POOL } from '../../database/database.module';
import { AppError } from '../../common/errors/app.error';
import { MailService } from '../../common/mail/mail.service';
import { AuthRepository } from './auth.repository';

function slugify(str: string): string {
  return (
    str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') +
    '-' +
    crypto.randomBytes(3).toString('hex')  // 6 hex chars, CSPRNG
  );
}

/** Mask email to avoid logging PII — e.g. "john.doe@example.com" → "jo***@example.com" */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
  return `${visible}***@${domain}`;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;
  private readonly saSecret: string;
  private readonly jwtExpires: jwt.SignOptions['expiresIn'];
  private readonly refreshSecret: string;
  private readonly refreshExpires: jwt.SignOptions['expiresIn'];

  constructor(
    @Inject(MYSQL_POOL) private readonly pool: Pool,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly authRepository: AuthRepository,
  ) {
    this.jwtSecret     = this.configService.get<string>('JWT_SECRET');
    this.saSecret      = this.configService.get<string>('SUPERADMIN_JWT_SECRET');
    this.jwtExpires    = this.configService.get<string>('JWT_EXPIRES_IN', '15m') as jwt.SignOptions['expiresIn'];
    this.refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    this.refreshExpires = this.configService.get<string>('JWT_REFRESH_EXPIRES', '7d') as jwt.SignOptions['expiresIn'];
  }

  // ── Token helpers ──────────────────────────────────────────────────────

  makeAccessToken(user: any, orgId: string | null, isOrgAdmin: boolean): string {
    return jwt.sign(
      {
        type: 'USER',
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        baseRole: user.base_role || user.role,
        orgId: orgId || null,
        hospitalId: user.hospital_id || null,
        isOrgAdmin: !!isOrgAdmin,
        customRoleId: user.custom_role_id || null,
      },
      this.jwtSecret,
      { expiresIn: this.jwtExpires },
    );
  }

  async makeRefreshToken(userId: string): Promise<string> {
    const tokenId = uuidv4();
    const token = jwt.sign(
      { type: 'REFRESH', userId, jti: tokenId },
      this.refreshSecret,
      { expiresIn: this.refreshExpires },
    );
    // Store ONLY the SHA-256 hash — the raw token never touches the database.
    // If the DB is breached, an attacker cannot use hashes to impersonate sessions.
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.pool.execute(
      'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [tokenId, userId, tokenHash, expiresAt],
    );
    return token;
  }

  // ── Superadmin login ───────────────────────────────────────────────────

  async superadminLogin(email: string, password: string) {
    this.logger.log(`[superadminLogin] attempt email=${maskEmail(email)}`);
    if (!email || !password) throw AppError.badRequest('Email and password are required');

    const sa = await this.authRepository.findSuperadminByEmail(email.trim().toLowerCase());
    if (!sa) { this.logger.warn(`[superadminLogin] not found email=${maskEmail(email)}`); throw AppError.unauthorized('Invalid credentials'); }

    const valid = await bcrypt.compare(password, sa.password);
    if (!valid) { this.logger.warn(`[superadminLogin] wrong password email=${maskEmail(email)}`); throw AppError.unauthorized('Invalid credentials'); }

    const token = jwt.sign(
      { type: 'SUPERADMIN', superAdminId: sa.id, name: sa.name, email: sa.email },
      this.saSecret,
      { expiresIn: '1d' },
    );
    this.logger.log(`[superadminLogin] success id=${sa.id}`);
    return { token, superAdmin: { id: sa.id, name: sa.name, email: sa.email } };
  }

  // ── Register ───────────────────────────────────────────────────────────


  async register(body: { name: string; email: string; password: string; role?: string; clinic_name?: string }) {
    this.logger.log(`[register] email=${maskEmail(body.email)} role=${body.role}`);
    const { name, email, password, role = 'DOCTOR', clinic_name } = body;

    if (!name || !email || !password) throw AppError.badRequest('Name, email and password are required');
    if (name.trim().length < 2) throw AppError.validation('Name must be at least 2 characters');
    if (password.length < 8)    throw AppError.validation('Password must be at least 8 characters');

    const normalEmail = email.trim().toLowerCase();
    const rawRole     = (role as string).toUpperCase();
    const upperRole   = rawRole === 'ADMIN' ? 'ORG_ADMIN' : rawRole;
    const VALID_ROLES = ['ORG_ADMIN', 'DOCTOR', 'PHARMACIST'];

    if (!VALID_ROLES.includes(upperRole)) {
      throw AppError.validation(`Role must be one of: ADMIN, DOCTOR, PHARMACIST`);
    }

    // Compute the hash before entering the transaction — bcrypt is CPU-heavy
    // and should not hold a DB connection open while it runs.
    const hashed  = await bcrypt.hash(password, 10);
    const userId  = uuidv4();
    const nameParts   = name.trim().split(' ');
    const firstName   = nameParts[0];
    const lastName    = nameParts.slice(1).join(' ') || '';
    const effectiveRole    = upperRole;
    const customRoleId: string | null = null;

    let orgId:     string | null = null;
    let isOwner    = false;
    let isOrgAdmin = false;

    // ── All DB writes in one atomic transaction ───────────────────────────
    // If any step fails (duplicate email, FK violation, etc.) every preceding
    // insert is rolled back, leaving the database in a clean state.
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Duplicate-email check — inside the transaction so the read and the
      //    subsequent insert are serialised, eliminating the race condition.
      const [existingRows]: any = await conn.execute(
        'SELECT id FROM users WHERE email = ? FOR UPDATE',
        [normalEmail],
      );
      if (existingRows.length > 0) throw AppError.conflict('Email already registered');

      // 2. Auto-create personal organisation for ORG_ADMIN and DOCTOR
      if (effectiveRole === 'ORG_ADMIN' || effectiveRole === 'DOCTOR') {
        const orgName  = clinic_name?.trim() ||
          (effectiveRole === 'ORG_ADMIN' ? `${name}'s Clinic` : `Dr. ${name}'s Practice`);
        const newOrgId = uuidv4();
        await conn.execute(
          'INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)',
          [newOrgId, orgName, slugify(orgName)],
        );
        orgId      = newOrgId;
        isOwner    = true;
        isOrgAdmin = true;
      }

      // 3. Insert user
      await conn.execute(
        `INSERT INTO users
           (id, name, email, password_hash, first_name, last_name, role,
            org_id, is_owner, is_org_admin, custom_role_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, name.trim(), normalEmail, hashed, firstName, lastName, effectiveRole,
         orgId, isOwner ? 1 : 0, isOrgAdmin ? 1 : 0, customRoleId],
      );

      // 4. Back-fill owner_id now that the user row exists (circular FK)
      if (isOwner && orgId) {
        await conn.execute(
          'UPDATE organizations SET owner_id = ? WHERE id = ?',
          [userId, orgId],
        );
      }

      // 5. Role-specific profile row
      if (effectiveRole === 'DOCTOR') {
        await conn.execute(
          'INSERT INTO doctor_profiles (id, user_id, role_id) VALUES (?, ?, ?)',
          [uuidv4(), userId, null],
        );
      } else if (effectiveRole === 'PHARMACIST') {
        await conn.execute(
          'INSERT INTO pharmacist_profiles (id, user_id, role_id) VALUES (?, ?, ?)',
          [uuidv4(), userId, null],
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    this.logger.log(`[register] user created id=${userId} orgId=${orgId} role=${effectiveRole}`);
    const accessToken  = this.makeAccessToken(
      { id: userId, name: name.trim(), email: normalEmail, role: effectiveRole, custom_role_id: customRoleId },
      orgId,
      isOrgAdmin,
    );
    const refreshToken = await this.makeRefreshToken(userId);

    return {
      token: accessToken,
      refreshToken,
      user: {
        id: userId, name: name.trim(), email: normalEmail, role: effectiveRole,
        clinic_name: clinic_name?.trim() || null, org_id: orgId,
        is_owner: isOwner, is_org_admin: isOrgAdmin,
      },
    };
  }

  // ── Login ──────────────────────────────────────────────────────────────

  async login(email: string, password: string) {
    this.logger.log(`[login] attempt email=${maskEmail(email)}`);
    if (!email || !password) throw AppError.badRequest('Email and password are required');

    const user = await this.authRepository.findUserByEmail(email.trim().toLowerCase());
    if (!user) { this.logger.warn(`[login] user not found email=${maskEmail(email)}`); throw AppError.unauthorized('Invalid email or password'); }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) { this.logger.warn(`[login] wrong password userId=${user.id}`); throw AppError.unauthorized('Invalid email or password'); }

    this.logger.log(`[login] success userId=${user.id} role=${user.role}`);
    const accessToken  = this.makeAccessToken(user, user.org_id, user.is_org_admin);
    const refreshToken = await this.makeRefreshToken(user.id);

    return {
      token: accessToken,
      refreshToken,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        clinic_name: user.clinic_name, org_id: user.org_id,
        hospital_id: user.hospital_id || null,
        is_owner: !!user.is_owner, is_org_admin: !!user.is_org_admin,
        custom_role_id: user.custom_role_id, role_display_name: user.role_display_name || null,
      },
    };
  }

  // ── Get current user ───────────────────────────────────────────────────

  async getMe(userId: string) {
    this.logger.debug(`[getMe] userId=${userId}`);
    if (!userId) throw AppError.unauthorized();
    const user = await this.authRepository.findUserById(userId);
    if (!user) throw AppError.notFound('User');
    return user;
  }

  // ── Token refresh ──────────────────────────────────────────────────────

  async refresh(refreshToken: string) {
    this.logger.debug(`[refresh] token rotation requested`);
    if (!refreshToken) throw AppError.unauthorized('Refresh token required');

    let payload: any;
    try { payload = jwt.verify(refreshToken, this.refreshSecret); }
    catch { throw AppError.unauthorized('Invalid or expired refresh token'); }

    if (payload.type !== 'REFRESH') throw AppError.unauthorized('Invalid token type');

    // Hash the presented token — we never store the raw token, only its digest.
    const incomingHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const [storedRows]: any = await this.pool.execute(
      'SELECT * FROM refresh_tokens WHERE token_hash = ? AND expires_at > NOW()',
      [incomingHash],
    );
    const stored = storedRows[0];
    if (!stored) throw AppError.unauthorized('Refresh token revoked or expired');

    const [userRows]: any = await this.pool.execute(
      `SELECT u.*, r.base_role, r.display_name AS role_display_name
       FROM users u LEFT JOIN roles r ON u.custom_role_id = r.id WHERE u.id = ?`,
      [stored.user_id],
    );
    const fullUser = userRows[0];
    if (!fullUser) throw AppError.unauthorized('User not found');

    // Rotate: delete old token, issue fresh pair (token rotation limits the
    // window of exposure if a refresh token is ever leaked).
    await this.pool.execute('DELETE FROM refresh_tokens WHERE id = ?', [stored.id]);
    const newAccessToken  = this.makeAccessToken(fullUser, fullUser.org_id, fullUser.is_org_admin);
    const newRefreshToken = await this.makeRefreshToken(fullUser.id);

    return { token: newAccessToken, refreshToken: newRefreshToken };
  }

  // ── Logout ─────────────────────────────────────────────────────────────

  async logout(refreshToken: string) {
    if (!refreshToken) throw AppError.badRequest('Refresh token required');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.pool.execute('DELETE FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);
  }

  // ── Forgot password ────────────────────────────────────────────────────

  async forgotPassword(email: string) {
    this.logger.log(`[forgotPassword] request for email=${maskEmail(email)}`);
    const normalEmail = email.trim().toLowerCase();

    // Always return same message — never reveal whether the email exists
    const [rows]: any = await this.pool.execute(
      'SELECT id, name FROM users WHERE email = ?', [normalEmail],
    );
    if ((rows as any[]).length === 0) {
      return { message: 'If that email is registered, an OTP has been sent.' };
    }

    const { id: userId, name: userName } = (rows as any[])[0];

    // Invalidate any existing unused OTPs for this user
    await this.pool.execute(
      'DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL',
      [userId],
    );

    // Generate a cryptographically secure 6-digit OTP
    const otp      = String(crypto.randomInt(100000, 1000000));
    const otpHash  = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.pool.execute(
      'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), userId, otpHash, expiresAt],
    );

    // Send OTP via email — raw OTP is never stored, only its SHA-256 hash
    await this.mailService.sendPasswordReset(normalEmail, userName, otp, userId);

    return { message: 'If that email is registered, an OTP has been sent.' };
  }

  // ── Reset password (OTP-based) ─────────────────────────────────────────

  async resetPassword(email: string, otp: string, newPassword: string) {
    this.logger.log(`[resetPassword] attempt email=${maskEmail(email)}`);
    const normalEmail = email.trim().toLowerCase();
    const otpHash     = crypto.createHash('sha256').update(otp.trim()).digest('hex');

    const [rows]: any = await this.pool.execute(
      `SELECT prt.id, prt.user_id FROM password_reset_tokens prt
       INNER JOIN users u ON u.id = prt.user_id
       WHERE u.email = ? AND prt.token_hash = ? AND prt.used_at IS NULL AND prt.expires_at > NOW()`,
      [normalEmail, otpHash],
    );
    const record = (rows as any[])[0];
    if (!record) throw AppError.badRequest('OTP is invalid or has expired');

    const hashed = await bcrypt.hash(newPassword, 10);

    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [hashed, record.user_id],
      );
      await conn.execute(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?',
        [record.id],
      );
      // Revoke all active refresh tokens — force re-login on all devices
      await conn.execute(
        'DELETE FROM refresh_tokens WHERE user_id = ?',
        [record.user_id],
      );
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    return { message: 'Password reset successfully. Please log in with your new password.' };
  }
}
