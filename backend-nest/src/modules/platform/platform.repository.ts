import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool } from 'mysql2/promise';
import { MYSQL_POOL } from '../../database/database.module';

@Injectable()
export class PlatformRepository {
  private readonly logger = new Logger(PlatformRepository.name);

  constructor(@Inject(MYSQL_POOL) private readonly pool: Pool) {}

  // ── Plans ─────────────────────────────────────────────────────────────

  async listActivePlans() {
    this.logger.debug(`[listActivePlans]`);
    const [rows]: any = await this.pool.execute(
      'SELECT * FROM plans WHERE is_active = 1 ORDER BY price_monthly ASC',
    );
    return rows;
  }

  async findPlanById(id: string) {
    this.logger.debug(`[findPlanById] id=${id}`);
    const [rows]: any = await this.pool.execute('SELECT * FROM plans WHERE id = ?', [id]);
    return (rows as any[])[0] ?? null;
  }

  async findPlanByName(name: string) {
    this.logger.debug(`[findPlanByName] name=${name}`);
    const [rows]: any = await this.pool.execute('SELECT * FROM plans WHERE name = ?', [name]);
    return (rows as any[])[0] ?? null;
  }

  async insertPlan(id: string, name: string, priceMonthly: number, priceYearly: number,
    prescriptionLimit: number, teamLimit: number, hospitalLimit: number,
    features: any, isActive: boolean) {
    this.logger.debug(`[insertPlan] name=${name}`);
    await this.pool.execute(
      `INSERT INTO plans (id, name, price_monthly, price_yearly, prescription_limit, team_limit, hospital_limit, features, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, priceMonthly, priceYearly, prescriptionLimit, teamLimit, hospitalLimit,
       JSON.stringify(features ?? {}), isActive ? 1 : 0],
    );
    return this.findPlanById(id);
  }

  async updatePlan(id: string, fields: Record<string, any>) {
    this.logger.debug(`[updatePlan] id=${id}`);
    const keys   = Object.keys(fields);
    const values = Object.values(fields);
    await this.pool.execute(
      `UPDATE plans SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`,
      [...values, id],
    );
    return this.findPlanById(id);
  }

  async deletePlan(id: string) {
    this.logger.debug(`[deletePlan] id=${id}`);
    await this.pool.execute('DELETE FROM plans WHERE id = ?', [id]);
  }

  // ── Superadmins ───────────────────────────────────────────────────────

  async findSuperadminByEmail(email: string) {
    this.logger.debug(`[findSuperadminByEmail] email=${email}`);
    const [rows]: any = await this.pool.execute(
      'SELECT * FROM superadmins WHERE email = ?', [email],
    );
    return (rows as any[])[0] ?? null;
  }

  async insertSuperadmin(id: string, name: string, email: string, passwordHash: string) {
    this.logger.debug(`[insertSuperadmin] email=${email}`);
    await this.pool.execute(
      'INSERT INTO superadmins (id, name, email, password) VALUES (?, ?, ?, ?)',
      [id, name, email, passwordHash],
    );
  }

  // ── Organizations ─────────────────────────────────────────────────────

  async listOrgs(params: { page: number; limit: number; search?: string; status?: string }) {
    this.logger.debug(`[listOrgs] page=${params.page} search=${params.search}`);
    const offset = (params.page - 1) * params.limit;
    const conditions: string[] = [];
    const values: any[]        = [];

    if (params.search?.trim()) {
      conditions.push('(o.name LIKE ? OR o.slug LIKE ?)');
      values.push(`%${params.search}%`, `%${params.search}%`);
    }
    if (params.status) {
      conditions.push('o.status = ?');
      values.push(params.status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows]: any = await this.pool.execute(
      `SELECT o.*, p.name AS plan_name, COUNT(u.id) AS team_count
       FROM organizations o
       LEFT JOIN plans p ON p.id = o.plan_id
       LEFT JOIN users u ON u.org_id = o.id
       ${where}
       GROUP BY o.id ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      [...values, params.limit, offset],
    );
    const [[{ total }]]: any = await this.pool.execute(
      `SELECT COUNT(*) AS total FROM organizations o ${where}`, values,
    );
    return { orgs: rows, total };
  }

  async findOrgById(orgId: string) {
    this.logger.debug(`[findOrgById] orgId=${orgId}`);
    const [rows]: any = await this.pool.execute(
      `SELECT o.*, p.name AS plan_name FROM organizations o
       LEFT JOIN plans p ON p.id = o.plan_id WHERE o.id = ?`, [orgId],
    );
    return (rows as any[])[0] ?? null;
  }

  async updateOrgStatus(orgId: string, status: string) {
    this.logger.debug(`[updateOrgStatus] orgId=${orgId} status=${status}`);
    await this.pool.execute('UPDATE organizations SET status = ? WHERE id = ?', [status, orgId]);
    return this.findOrgById(orgId);
  }

  async assignPlanToOrg(orgId: string, planId: string, prescriptionLimit: number, teamLimit: number, hospitalLimit: number) {
    this.logger.debug(`[assignPlanToOrg] orgId=${orgId} planId=${planId}`);
    await this.pool.execute(
      `UPDATE organizations SET plan_id = ?, prescription_limit = ?, team_limit = ?, hospital_limit = ? WHERE id = ?`,
      [planId, prescriptionLimit, teamLimit, hospitalLimit, orgId],
    );
  }

  async insertDefaultRoles(conn: any, orgId: string, roles: any[]) {
    for (const r of roles) {
      await conn.execute(
        `INSERT INTO roles (id, org_id, name, display_name, base_role, permissions, color, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [r.id, orgId, r.name, r.display_name, r.base_role, JSON.stringify(r.permissions), r.color],
      );
    }
  }

  async getConnection() { return this.pool.getConnection(); }
}
