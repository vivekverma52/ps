/**
 * OrganizationService — Level 1
 * Covers: Organizations · Roles · Usage Counters
 */
import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool } from 'mysql2/promise';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { MYSQL_POOL } from '../../database/database.module';
import { AppError } from '../../common/errors/app.error';
import { OrganizationRepository } from './organization.repository';
import { UpdateOrgDto } from './dto/update-org.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

const VALID_BASE_ROLES = ['DOCTOR', 'PHARMACIST', 'VIEWER', 'ADMIN'] as const;
type BaseRole = typeof VALID_BASE_ROLES[number];

const BASE_ROLE_MAP: Record<BaseRole, string> = {
  DOCTOR: 'DOCTOR',
  PHARMACIST: 'PHARMACIST',
  VIEWER: 'PHARMACIST',
  ADMIN: 'DOCTOR',
};

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    @Inject(MYSQL_POOL) private readonly pool: Pool,
    private readonly orgRepository: OrganizationRepository,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────

  private async assertOrgExists(orgId: string | null): Promise<void> {
    if (!orgId) throw AppError.notFound('Organization');
    const [rows]: any = await this.pool.execute('SELECT id FROM organizations WHERE id = ?', [orgId]);
    if ((rows as any[]).length === 0) throw AppError.notFound('Organization');
  }

  private async assertOwner(userId: string, orgId: string | null): Promise<void> {
    const [rows]: any = await this.pool.execute(
      'SELECT id FROM users WHERE id = ? AND org_id = ? AND is_owner = 1',
      [userId, orgId],
    );
    if ((rows as any[]).length === 0) throw AppError.forbidden('Only org owner can perform this action', 'NOT_OWNER');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ORGANIZATION — core
  // ═══════════════════════════════════════════════════════════════════════

  async getOrg(orgId: string) {
    this.logger.log(`[getOrg] orgId=${orgId}`);
    await this.assertOrgExists(orgId);
    const [orgRows]: any = await this.pool.execute('SELECT * FROM organizations WHERE id = ?', [orgId]);
    const org = (orgRows as any[])[0];

    const [[{ count: usage_this_month }]]: any = await this.pool.execute(
      `SELECT COUNT(*) AS count FROM prescriptions
       WHERE org_id = ? AND MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())`,
      [orgId],
    );
    const [[{ count: team_count }]]: any = await this.pool.execute(
      'SELECT COUNT(*) AS count FROM users WHERE org_id = ?', [orgId],
    );
    return { ...org, usage_this_month, team_count };
  }

  async updateOrg(userId: string, orgId: string | null, dto: UpdateOrgDto) {
    this.logger.log(`[updateOrg] userId=${userId} orgId=${orgId}`);
    await this.assertOrgExists(orgId);
    await this.assertOwner(userId, orgId);

    await this.pool.execute(
      'UPDATE organizations SET name = ?, address = ?, phone = ?, website = ? WHERE id = ?',
      [
        dto.name.trim(),
        dto.address?.trim() || null,
        dto.phone?.trim() || null,
        dto.website?.trim() || null,
        orgId,
      ],
    );
    const [rows]: any = await this.pool.execute('SELECT * FROM organizations WHERE id = ?', [orgId]);
    return (rows as any[])[0];
  }

  async changePlan(userId: string, orgId: string | null, planName: string) {
    await this.assertOrgExists(orgId);
    await this.assertOwner(userId, orgId);

    const upperPlan = planName.toUpperCase();
    const [planRows]: any = await this.pool.execute(
      'SELECT id, name FROM plans WHERE UPPER(name) = ? AND is_active = 1',
      [upperPlan],
    );
    if ((planRows as any[]).length === 0) throw AppError.validation(`Plan not found: ${upperPlan}`);

    await this.pool.execute(
      'UPDATE organizations SET plan_id = ? WHERE id = ?',
      [(planRows as any[])[0].id, orgId],
    );
    return { plan: (planRows as any[])[0].name };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TEAM — members
  // ═══════════════════════════════════════════════════════════════════════

  async getTeam(orgId: string | null) {
    await this.assertOrgExists(orgId);
    const [members]: any = await this.pool.execute(
      `SELECT u.id, u.name, u.email, u.role, u.is_owner, u.is_org_admin, u.created_at,
              r.display_name AS role_display_name, r.color AS role_color
       FROM users u LEFT JOIN roles r ON u.custom_role_id = r.id
       WHERE u.org_id = ? ORDER BY u.is_owner DESC, u.created_at ASC`,
      [orgId],
    );
    return { members };
  }

  async createMember(userId: string, orgId: string | null, dto: CreateMemberDto) {
    this.logger.log(`[createMember] by userId=${userId} orgId=${orgId} email=${dto.email}`);
    await this.assertOrgExists(orgId);
    await this.assertOwner(userId, orgId);

    const [orgRows]: any = await this.pool.execute(
      `SELECT o.id, p.max_staff_per_hospital FROM organizations o LEFT JOIN plans p ON p.id = o.plan_id WHERE o.id = ?`,
      [orgId],
    );
    const org = (orgRows as any[])[0];
    const [[{ count }]]: any = await this.pool.execute(
      'SELECT COUNT(*) AS count FROM users WHERE org_id = ?', [orgId],
    );
    const staffLimit: number = org?.max_staff_per_hospital ?? 0;
    if (staffLimit > 0 && count >= staffLimit) {
      throw new AppError(`Team limit reached (${staffLimit} members). Please upgrade your plan.`, 403, 'TEAM_LIMIT_EXCEEDED');
    }

    const normalEmail = dto.email.trim().toLowerCase();
    const hashed      = await bcrypt.hash(dto.password, 10);
    const memberId    = uuidv4();
    const nameParts   = dto.name.trim().split(' ');
    const firstName   = nameParts[0];
    const lastName    = nameParts.slice(1).join(' ') || '';
    const upperRole   = dto.role.toUpperCase();

    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      const [existing]: any = await conn.execute(
        'SELECT id FROM users WHERE email = ? FOR UPDATE', [normalEmail],
      );
      if ((existing as any[]).length > 0) throw AppError.conflict('A user with this email already exists');

      await conn.execute(
        `INSERT INTO users
           (id, name, email, password_hash, first_name, last_name,
            role, org_id, is_owner, is_org_admin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        [memberId, dto.name.trim(), normalEmail, hashed, firstName, lastName, upperRole, orgId],
      );

      if (upperRole === 'DOCTOR') {
        await conn.execute(
          'INSERT INTO doctor_profiles (id, user_id) VALUES (?, ?)', [uuidv4(), memberId],
        );
      } else {
        await conn.execute(
          'INSERT INTO pharmacist_profiles (id, user_id) VALUES (?, ?)', [uuidv4(), memberId],
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    return { id: memberId, name: dto.name.trim(), email: normalEmail, role: upperRole };
  }

  async removeMember(userId: string, orgId: string | null, memberId: string) {
    this.logger.log(`[removeMember] by userId=${userId} orgId=${orgId} memberId=${memberId}`);
    await this.assertOrgExists(orgId);
    await this.assertOwner(userId, orgId);

    if (memberId === userId) throw AppError.badRequest('You cannot remove yourself from the organization');

    const [memberRows]: any = await this.pool.execute(
      'SELECT id, is_owner FROM users WHERE id = ? AND org_id = ?', [memberId, orgId],
    );
    const member = (memberRows as any[])[0];
    if (!member) throw AppError.notFound('Member');
    if (member.is_owner) throw AppError.forbidden('Cannot remove the organization owner');

    await this.pool.execute(
      'UPDATE users SET org_id = NULL, is_owner = 0, is_org_admin = 0, custom_role_id = NULL WHERE id = ?',
      [memberId],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ROLES
  // ═══════════════════════════════════════════════════════════════════════

  async listRoles(orgId: string | null) {
    if (!orgId) throw AppError.notFound('Organization');
    const [rows]: any = await this.pool.execute(
      'SELECT * FROM roles WHERE org_id = ? ORDER BY created_at ASC', [orgId],
    );
    return rows;
  }

  async createRole(orgId: string, dto: CreateRoleDto) {
    this.logger.log(`[createRole] orgId=${orgId} name=${dto.name}`);
    const upperBaseRole = (dto.base_role ?? 'DOCTOR').toUpperCase() as BaseRole;

    const [existing]: any = await this.pool.execute(
      'SELECT id FROM roles WHERE org_id = ? AND name = ?', [orgId, dto.name.trim()],
    );
    if ((existing as any[]).length > 0) throw AppError.conflict('A role with this name already exists');

    const id = uuidv4();
    await this.pool.execute(
      `INSERT INTO roles (id, org_id, name, display_name, base_role, permissions, color, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        dto.name.trim(),
        dto.display_name.trim(),
        upperBaseRole,
        JSON.stringify(dto.permissions ?? {}),
        dto.color ?? '#1D9E75',
        dto.is_default ? 1 : 0,
      ],
    );
    const [rows]: any = await this.pool.execute('SELECT * FROM roles WHERE id = ?', [id]);
    return (rows as any[])[0];
  }

  async updateRole(id: string, orgId: string | null, dto: UpdateRoleDto) {
    const [currentRows]: any = await this.pool.execute(
      'SELECT * FROM roles WHERE id = ? AND org_id = ?', [id, orgId],
    );
    const current = (currentRows as any[])[0];
    if (!current) throw AppError.notFound('Role');

    const newDisplayName = dto.display_name !== undefined ? dto.display_name.trim() : current.display_name;
    const newBaseRole    = dto.base_role    !== undefined ? dto.base_role.toUpperCase() : current.base_role;
    const newPermissions = dto.permissions  !== undefined ? dto.permissions : JSON.parse(current.permissions || '{}');
    const newColor       = dto.color        !== undefined ? dto.color : current.color;
    const newIsDefault   = dto.is_default   !== undefined ? dto.is_default : !!current.is_default;

    await this.pool.execute(
      `UPDATE roles SET display_name = ?, base_role = ?, permissions = ?, color = ?, is_default = ? WHERE id = ?`,
      [newDisplayName, newBaseRole, JSON.stringify(newPermissions), newColor, newIsDefault ? 1 : 0, id],
    );
    const [rows]: any = await this.pool.execute('SELECT * FROM roles WHERE id = ?', [id]);
    return (rows as any[])[0];
  }

  async removeRole(id: string, orgId: string | null) {
    const [existing]: any = await this.pool.execute(
      'SELECT id FROM roles WHERE id = ? AND org_id = ?', [id, orgId],
    );
    if ((existing as any[]).length === 0) throw AppError.notFound('Role');

    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('UPDATE users SET custom_role_id = NULL WHERE custom_role_id = ?', [id]);
      await conn.execute('DELETE FROM roles WHERE id = ?', [id]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async assignRole(orgId: string | null, dto: AssignRoleDto) {
    const [roleRows]: any = await this.pool.execute(
      'SELECT * FROM roles WHERE id = ? AND org_id = ?', [dto.role_id, orgId],
    );
    const role = (roleRows as any[])[0];
    if (!role) throw AppError.notFound('Role');

    const [userRows]: any = await this.pool.execute(
      'SELECT id FROM users WHERE id = ? AND org_id = ?', [dto.user_id, orgId],
    );
    if ((userRows as any[]).length === 0) throw AppError.notFound('User');

    const baseRole = BASE_ROLE_MAP[role.base_role as BaseRole] ?? 'DOCTOR';
    await this.pool.execute(
      'UPDATE users SET custom_role_id = ?, role = ? WHERE id = ?',
      [dto.role_id, baseRole, dto.user_id],
    );
    return { role };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // USAGE COUNTERS
  // ═══════════════════════════════════════════════════════════════════════

  async getUsageCounter(orgId: string, rx_month: number, rx_year: number) {
    const [rows]: any = await this.pool.execute(
      'SELECT * FROM org_usage_counters WHERE org_id = ? AND rx_month = ? AND rx_year = ?',
      [orgId, rx_month, rx_year],
    );
    return (rows as any[])[0] ?? { org_id: orgId, rx_count: 0, rx_month, rx_year };
  }

  async incrementUsageCounter(orgId: string) {
    const now      = new Date();
    const rx_month = now.getMonth() + 1;
    const rx_year  = now.getFullYear();

    await this.pool.execute(
      `INSERT INTO org_usage_counters (id, org_id, rx_month, rx_year, rx_count)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE rx_count = rx_count + 1`,
      [uuidv4(), orgId, rx_month, rx_year],
    );
  }

  async getUsageHistory(orgId: string) {
    const [rows]: any = await this.pool.execute(
      'SELECT * FROM org_usage_counters WHERE org_id = ? ORDER BY rx_year DESC, rx_month DESC LIMIT 12',
      [orgId],
    );
    return rows;
  }
}
