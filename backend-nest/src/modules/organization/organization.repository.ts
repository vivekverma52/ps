import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool } from 'mysql2/promise';
import { MYSQL_POOL } from '../../database/database.module';

@Injectable()
export class OrganizationRepository {
  private readonly logger = new Logger(OrganizationRepository.name);

  constructor(@Inject(MYSQL_POOL) private readonly pool: Pool) {}

  async getConnection() { return this.pool.getConnection(); }

  // ── Organizations ─────────────────────────────────────────────────────

  async findOrgById(orgId: string) {
    this.logger.debug(`[findOrgById] orgId=${orgId}`);
    const [rows]: any = await this.pool.execute(
      'SELECT * FROM organizations WHERE id = ?', [orgId],
    );
    return (rows as any[])[0] ?? null;
  }

  async updateOrg(orgId: string, name: string, address: string | null, phone: string | null, website: string | null) {
    this.logger.debug(`[updateOrg] orgId=${orgId}`);
    await this.pool.execute(
      'UPDATE organizations SET name = ?, address = ?, phone = ?, website = ? WHERE id = ?',
      [name, address, phone, website, orgId],
    );
    return this.findOrgById(orgId);
  }

  async findPlanById(planId: string) {
    const [rows]: any = await this.pool.execute(
      'SELECT id, name FROM plans WHERE UPPER(name) = ? AND is_active = 1', [planId],
    );
    return (rows as any[])[0] ?? null;
  }

  async setPlanOnOrg(orgId: string, planId: string) {
    this.logger.debug(`[setPlanOnOrg] orgId=${orgId} planId=${planId}`);
    await this.pool.execute('UPDATE organizations SET plan_id = ? WHERE id = ?', [planId, orgId]);
  }

  async countPrescriptionsThisMonth(orgId: string): Promise<number> {
    const [[{ count }]]: any = await this.pool.execute(
      `SELECT COUNT(*) AS count FROM prescriptions
       WHERE org_id = ? AND MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())`,
      [orgId],
    );
    return count as number;
  }

  async countTeamMembers(orgId: string): Promise<number> {
    const [[{ count }]]: any = await this.pool.execute(
      'SELECT COUNT(*) AS count FROM users WHERE org_id = ?', [orgId],
    );
    return count as number;
  }

  // ── Users / team ─────────────────────────────────────────────────────

  async findOwner(userId: string, orgId: string) {
    this.logger.debug(`[findOwner] userId=${userId} orgId=${orgId}`);
    const [rows]: any = await this.pool.execute(
      'SELECT id FROM users WHERE id = ? AND org_id = ? AND is_owner = 1', [userId, orgId],
    );
    return (rows as any[])[0] ?? null;
  }

  async listTeamMembers(orgId: string) {
    this.logger.debug(`[listTeamMembers] orgId=${orgId}`);
    const [rows]: any = await this.pool.execute(
      `SELECT u.id, u.name, u.email, u.role, u.is_owner, u.is_org_admin, u.created_at,
              r.display_name AS role_display_name, r.color AS role_color
       FROM users u LEFT JOIN roles r ON u.custom_role_id = r.id
       WHERE u.org_id = ? ORDER BY u.is_owner DESC, u.created_at ASC`,
      [orgId],
    );
    return rows;
  }

  async findMemberInOrg(memberId: string, orgId: string) {
    this.logger.debug(`[findMemberInOrg] memberId=${memberId} orgId=${orgId}`);
    const [rows]: any = await this.pool.execute(
      'SELECT id, is_owner FROM users WHERE id = ? AND org_id = ?', [memberId, orgId],
    );
    return (rows as any[])[0] ?? null;
  }

  async findOrgPlanLimits(orgId: string) {
    const [rows]: any = await this.pool.execute(
      `SELECT o.id, p.max_staff_per_hospital FROM organizations o LEFT JOIN plans p ON p.id = o.plan_id WHERE o.id = ?`,
      [orgId],
    );
    return (rows as any[])[0] ?? null;
  }

  async findUserByEmailForLock(conn: any, email: string) {
    const [rows]: any = await conn.execute(
      'SELECT id FROM users WHERE email = ? FOR UPDATE', [email],
    );
    return (rows as any[])[0] ?? null;
  }

  async insertMember(conn: any, params: {
    id: string; name: string; email: string; passwordHash: string;
    firstName: string; lastName: string; role: string; orgId: string;
  }) {
    await conn.execute(
      `INSERT INTO users (id, name, email, password_hash, first_name, last_name, role, org_id, is_owner, is_org_admin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [params.id, params.name, params.email, params.passwordHash,
       params.firstName, params.lastName, params.role, params.orgId],
    );
  }

  async insertDoctorProfile(conn: any, id: string, userId: string) {
    await conn.execute('INSERT INTO doctor_profiles (id, user_id) VALUES (?, ?)', [id, userId]);
  }

  async insertPharmacistProfile(conn: any, id: string, userId: string) {
    await conn.execute('INSERT INTO pharmacist_profiles (id, user_id) VALUES (?, ?)', [id, userId]);
  }

  async removeMember(memberId: string) {
    this.logger.debug(`[removeMember] memberId=${memberId}`);
    await this.pool.execute(
      'UPDATE users SET org_id = NULL, is_owner = 0, is_org_admin = 0, custom_role_id = NULL WHERE id = ?',
      [memberId],
    );
  }

  // ── Roles ─────────────────────────────────────────────────────────────

  async listRoles(orgId: string) {
    this.logger.debug(`[listRoles] orgId=${orgId}`);
    const [rows]: any = await this.pool.execute(
      'SELECT * FROM roles WHERE org_id = ? ORDER BY created_at ASC', [orgId],
    );
    return rows;
  }

  async findRoleByName(orgId: string, name: string) {
    const [rows]: any = await this.pool.execute(
      'SELECT id FROM roles WHERE org_id = ? AND name = ?', [orgId, name],
    );
    return (rows as any[])[0] ?? null;
  }

  async findRoleById(id: string, orgId: string) {
    const [rows]: any = await this.pool.execute(
      'SELECT * FROM roles WHERE id = ? AND org_id = ?', [id, orgId],
    );
    return (rows as any[])[0] ?? null;
  }

  async insertRole(params: {
    id: string; orgId: string; name: string; displayName: string;
    baseRole: string; permissions: any; color: string; isDefault: boolean;
  }) {
    this.logger.debug(`[insertRole] orgId=${params.orgId} name=${params.name}`);
    await this.pool.execute(
      `INSERT INTO roles (id, org_id, name, display_name, base_role, permissions, color, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [params.id, params.orgId, params.name, params.displayName, params.baseRole,
       JSON.stringify(params.permissions), params.color, params.isDefault ? 1 : 0],
    );
    const [rows]: any = await this.pool.execute('SELECT * FROM roles WHERE id = ?', [params.id]);
    return (rows as any[])[0];
  }

  async updateRole(id: string, displayName: string, baseRole: string, permissions: any, color: string, isDefault: boolean) {
    this.logger.debug(`[updateRole] id=${id}`);
    await this.pool.execute(
      'UPDATE roles SET display_name = ?, base_role = ?, permissions = ?, color = ?, is_default = ? WHERE id = ?',
      [displayName, baseRole, JSON.stringify(permissions), color, isDefault ? 1 : 0, id],
    );
    const [rows]: any = await this.pool.execute('SELECT * FROM roles WHERE id = ?', [id]);
    return (rows as any[])[0];
  }

  async deleteRole(conn: any, id: string) {
    await conn.execute('UPDATE users SET custom_role_id = NULL WHERE custom_role_id = ?', [id]);
    await conn.execute('DELETE FROM roles WHERE id = ?', [id]);
  }

  async assignRoleToUser(userId: string, roleId: string | null, orgId: string) {
    this.logger.debug(`[assignRoleToUser] userId=${userId} roleId=${roleId}`);
    await this.pool.execute(
      'UPDATE users SET custom_role_id = ? WHERE id = ? AND org_id = ?', [roleId, userId, orgId],
    );
  }
}
