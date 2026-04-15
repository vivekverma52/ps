/**
 * PlatformService — Level 0
 * Covers: Superadmin management + Plans table
 */
import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool } from 'mysql2/promise';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { MYSQL_POOL } from '../../database/database.module';
import { AppError } from '../../common/errors/app.error';
import { PlatformRepository } from './platform.repository';

const VALID_STATUSES = ['ACTIVE', 'SUSPENDED'];

const DEFAULT_ROLES = [
  { name: 'doctor',     display_name: 'Doctor',     base_role: 'DOCTOR',     color: '#1D9E75',
    permissions: { create_prescription: true,  view_all_prescriptions: false, delete_prescription: true,  manage_medicines: true,  manage_team: false } },
  { name: 'pharmacist', display_name: 'Pharmacist', base_role: 'PHARMACIST', color: '#7C3AED',
    permissions: { create_prescription: false, view_all_prescriptions: true,  delete_prescription: false, manage_medicines: false, manage_team: false } },
  { name: 'admin',      display_name: 'Admin',      base_role: 'ADMIN',      color: '#F59E0B',
    permissions: { create_prescription: true,  view_all_prescriptions: true,  delete_prescription: true,  manage_medicines: true,  manage_team: true } },
];

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') +
    '-' + crypto.randomBytes(3).toString('hex'); // CSPRNG — 6 hex chars
}

const PLAN_LIMITS: Record<string, { prescription_limit: number; team_limit: number; hospital_limit: number }> = {
  FREE:       { prescription_limit: 10,    team_limit: 2,   hospital_limit: 1 },
  PRO:        { prescription_limit: 200,   team_limit: 10,  hospital_limit: 3 },
  GROWTH:     { prescription_limit: 1000,  team_limit: 50,  hospital_limit: 10 },
  ENT:        { prescription_limit: 99999, team_limit: 999, hospital_limit: 999 },
  ENTERPRISE: { prescription_limit: 99999, team_limit: 999, hospital_limit: 999 },
};

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

  constructor(
    @Inject(MYSQL_POOL) private readonly pool: Pool,
    private readonly platformRepository: PlatformRepository,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  // PLANS
  // ═══════════════════════════════════════════════════════════════════════

  async listPlans() {
    this.logger.log(`[listPlans]`);
    const [rows]: any = await this.pool.execute(
      'SELECT * FROM plans WHERE is_active = 1 ORDER BY price_monthly ASC',
    );
    return rows;
  }

  async getPlanById(id: string) {
    const [rows]: any = await this.pool.execute('SELECT * FROM plans WHERE id = ?', [id]);
    if (rows.length === 0) throw AppError.notFound('Plan');
    return rows[0];
  }

  async getPlanByName(name: string) {
    const [rows]: any = await this.pool.execute('SELECT * FROM plans WHERE name = ?', [name.toUpperCase()]);
    if (rows.length === 0) throw AppError.notFound('Plan');
    return rows[0];
  }

  async createPlan(dto: {
    name: 'FREE' | 'PRO' | 'GROWTH' | 'ENT';
    display_name: string;
    rx_limit: number;
    team_limit: number;
    hospital_limit: number;
    price_monthly?: number;
    features?: Record<string, any>;
  }) {
    const upper = dto.name.toUpperCase();
    const [existing]: any = await this.pool.execute('SELECT id FROM plans WHERE name = ?', [upper]);
    if (existing.length > 0) throw AppError.conflict('Plan with this name already exists');

    const id = uuidv4();
    await this.pool.execute(
      `INSERT INTO plans (id, name, display_name, rx_limit, team_limit, hospital_limit, price_monthly, features)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, upper, dto.display_name, dto.rx_limit, dto.team_limit, dto.hospital_limit,
       dto.price_monthly ?? 0, dto.features ? JSON.stringify(dto.features) : null],
    );
    return this.getPlanById(id);
  }

  async updatePlan(id: string, dto: Partial<{ display_name: string; rx_limit: number; team_limit: number; hospital_limit: number; price_monthly: number; features: any }>) {
    await this.getPlanById(id);
    const fields: string[] = [];
    const values: any[] = [];
    if (dto.display_name   !== undefined) { fields.push('display_name = ?');   values.push(dto.display_name); }
    if (dto.rx_limit       !== undefined) { fields.push('rx_limit = ?');       values.push(dto.rx_limit); }
    if (dto.team_limit     !== undefined) { fields.push('team_limit = ?');     values.push(dto.team_limit); }
    if (dto.hospital_limit !== undefined) { fields.push('hospital_limit = ?'); values.push(dto.hospital_limit); }
    if (dto.price_monthly  !== undefined) { fields.push('price_monthly = ?');  values.push(dto.price_monthly); }
    if (dto.features       !== undefined) { fields.push('features = ?');       values.push(JSON.stringify(dto.features)); }
    if (fields.length === 0) throw AppError.badRequest('No fields to update');
    values.push(id);
    await this.pool.execute(`UPDATE plans SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.getPlanById(id);
  }

  getPlanLimits(planName: string) {
    return PLAN_LIMITS[planName?.toUpperCase()] ?? PLAN_LIMITS.FREE;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SUPERADMIN — Organizations
  // ═══════════════════════════════════════════════════════════════════════

  private async assertOrgExists(id: string) {
    if (!id) throw AppError.badRequest('Organization ID is required');
    const [rows]: any = await this.pool.execute('SELECT id FROM organizations WHERE id = ?', [id]);
    if (rows.length === 0) throw AppError.notFound('Organization');
  }

  async getDashboard() {
    const [[orgStats]]: any = await this.pool.execute(
      `SELECT COUNT(*) AS total,
              SUM(status = 'ACTIVE')    AS active,
              SUM(status = 'SUSPENDED') AS suspended
       FROM organizations`,
    );
    const [[userStats]]: any  = await this.pool.execute('SELECT COUNT(*) AS total FROM users');
    const [[presStats]]: any  = await this.pool.execute('SELECT COUNT(*) AS total FROM prescriptions');
    const [[presMonth]]: any  = await this.pool.execute(
      `SELECT COUNT(*) AS count FROM prescriptions
       WHERE MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())`,
    );
    // Two derived-table JOINs replace the previous per-row correlated subqueries
    const [recentOrgs]: any = await this.pool.execute(
      `SELECT o.*,
         COALESCE(uc.user_count, 0)         AS user_count,
         COALESCE(pc.prescription_count, 0) AS prescription_count
       FROM organizations o
       LEFT JOIN (SELECT org_id, COUNT(*) AS user_count         FROM users         GROUP BY org_id) uc ON uc.org_id = o.id
       LEFT JOIN (SELECT org_id, COUNT(*) AS prescription_count FROM prescriptions GROUP BY org_id) pc ON pc.org_id = o.id
       ORDER BY o.created_at DESC LIMIT 5`,
    );
    return {
      stats: {
        total_orgs: orgStats.total, active_orgs: orgStats.active || 0,
        suspended_orgs: orgStats.suspended || 0, total_users: userStats.total,
        total_prescriptions: presStats.total, prescriptions_this_month: presMonth.count,
      },
      recent_orgs: recentOrgs,
    };
  }

  async listOrgs(query: { search?: string; plan?: string; status?: string }) {
    this.logger.log(`[listOrgs] search=${query.search} plan=${query.plan} status=${query.status}`);
    const { search, plan, status } = query;
    if (status && !VALID_STATUSES.includes(status.toUpperCase())) throw AppError.validation('Invalid status filter');

    // Derived-table JOINs run each aggregate once across all orgs,
    // replacing the previous approach of N × 5 correlated subqueries.
    let sql = `
      SELECT o.*,
        COALESCE(uc.user_count, 0)                    AS user_count,
        COALESCE(pc.prescription_count, 0)            AS prescription_count,
        COALESCE(pm.prescriptions_this_month, 0)      AS prescriptions_this_month,
        owner.name                                    AS owner_name,
        owner.email                                   AS owner_email
      FROM organizations o
      LEFT JOIN (SELECT org_id, COUNT(*) AS user_count FROM users GROUP BY org_id) uc
        ON uc.org_id = o.id
      LEFT JOIN (SELECT org_id, COUNT(*) AS prescription_count FROM prescriptions GROUP BY org_id) pc
        ON pc.org_id = o.id
      LEFT JOIN (
        SELECT org_id, COUNT(*) AS prescriptions_this_month
        FROM prescriptions
        WHERE MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())
        GROUP BY org_id
      ) pm ON pm.org_id = o.id
      LEFT JOIN users owner ON owner.id = o.owner_id
      WHERE 1=1`;
    const params: any[] = [];
    if (search) { sql += ' AND o.name LIKE ?'; params.push(`%${search.trim()}%`); }
    if (plan)   { sql += ' AND o.plan = ?';    params.push(plan.toUpperCase()); }
    if (status) { sql += ' AND o.status = ?';  params.push(status.toUpperCase()); }
    sql += ' ORDER BY o.created_at DESC LIMIT 200';

    const [orgs]: any = await this.pool.execute(sql, params);
    return orgs;
  }

  async getOrgDetail(id: string) {
    await this.assertOrgExists(id);

    const [orgs]: any = await this.pool.execute(
      `SELECT o.*,
         (SELECT COUNT(*) FROM users u         WHERE u.org_id = o.id) AS user_count,
         (SELECT COUNT(*) FROM prescriptions p WHERE p.org_id = o.id) AS prescription_count,
         (SELECT COUNT(*) FROM prescriptions p WHERE p.org_id = o.id
            AND MONTH(p.created_at) = MONTH(NOW()) AND YEAR(p.created_at) = YEAR(NOW())) AS prescriptions_this_month,
         (SELECT u.name  FROM users u WHERE u.id = o.owner_id LIMIT 1) AS owner_name,
         (SELECT u.email FROM users u WHERE u.id = o.owner_id LIMIT 1) AS owner_email
       FROM organizations o WHERE o.id = ?`,
      [id],
    );
    const [members]: any = await this.pool.execute(
      `SELECT u.id, u.name, u.email, u.role, u.is_owner, u.is_org_admin, u.created_at,
              r.display_name AS role_display_name, r.color AS role_color
       FROM users u LEFT JOIN roles r ON u.custom_role_id = r.id
       WHERE u.org_id = ? ORDER BY u.is_owner DESC, u.created_at ASC`,
      [id],
    );
    const [roles]: any = await this.pool.execute(
      'SELECT * FROM roles WHERE org_id = ? ORDER BY created_at ASC', [id],
    );
    const [recent_prescriptions]: any = await this.pool.execute(
      `SELECT id, patient_name, doctor_name, status, created_at
       FROM prescriptions WHERE org_id = ? ORDER BY created_at DESC LIMIT 10`, [id],
    );
    return { ...orgs[0], users: members, roles, recent_prescriptions };
  }

  async createOrg(body: any) {
    this.logger.log(`[createOrg] name=${body.name} plan=${body.plan}`);
    const { org_name, plan = 'FREE', admin_name, admin_email, admin_password,
            address, phone, website, pharmacist_name, pharmacist_email, pharmacist_password } = body;

    if (!org_name || !admin_name || !admin_email || !admin_password) {
      throw AppError.badRequest('org_name, admin_name, admin_email and admin_password are required');
    }
    if (admin_password.length < 8)       throw AppError.validation('Admin password must be at least 8 characters');
    if (org_name.trim().length < 2)      throw AppError.validation('Organization name must be at least 2 characters');
    if (admin_name.trim().length < 2)    throw AppError.validation('Admin name must be at least 2 characters');

    const upperPlan = plan.toUpperCase();
    if (!PLAN_LIMITS[upperPlan])         throw AppError.validation(`Plan must be one of: ${Object.keys(PLAN_LIMITS).join(', ')}`);

    const hasPharmacist = !!(pharmacist_name && pharmacist_email && pharmacist_password);
    if (hasPharmacist) {
      if (pharmacist_password.length < 8)  throw AppError.validation('Pharmacist password must be at least 8 characters');
      if (pharmacist_name.trim().length < 2) throw AppError.validation('Pharmacist name must be at least 2 characters');
    }

    const normalAdminEmail = admin_email.trim().toLowerCase();
    const [existing]: any  = await this.pool.execute('SELECT id FROM users WHERE email = ?', [normalAdminEmail]);
    if (existing.length > 0) throw AppError.conflict('A user with this admin email already exists');

    const normalPharmacistEmail = hasPharmacist ? pharmacist_email.trim().toLowerCase() : null;
    if (normalPharmacistEmail) {
      if (normalPharmacistEmail === normalAdminEmail) throw AppError.conflict('Pharmacist email must differ from admin email');
      const [existingPh]: any = await this.pool.execute('SELECT id FROM users WHERE email = ?', [normalPharmacistEmail]);
      if (existingPh.length > 0) throw AppError.conflict('A user with this pharmacist email already exists');
    }

    const { prescription_limit, team_limit } = PLAN_LIMITS[upperPlan];
    const orgId         = uuidv4();
    const adminId       = uuidv4();
    const pharmacistId  = hasPharmacist ? uuidv4() : null;
    const hashedAdmin   = await bcrypt.hash(admin_password, 10);
    const hashedPharm   = hasPharmacist ? await bcrypt.hash(pharmacist_password, 10) : null;

    const conn = await (this.pool as any).getConnection();
    try {
      await conn.beginTransaction();

      await conn.execute(
        `INSERT INTO organizations (id, name, slug, plan, prescription_limit, team_limit, owner_id, address, phone, website)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orgId, org_name.trim(), slugify(org_name), upperPlan, prescription_limit, team_limit,
         adminId, address?.trim() || null, phone?.trim() || null, website?.trim() || null],
      );

      await conn.execute(
        `INSERT INTO users (id, name, email, password_hash, role, org_id, is_owner, is_org_admin)
         VALUES (?, ?, ?, ?, 'ORG_ADMIN', ?, 1, 1)`,
        [adminId, admin_name.trim(), normalAdminEmail, hashedAdmin, orgId],
      );
      if (hasPharmacist) {
        await conn.execute(
          `INSERT INTO users (id, name, email, password_hash, role, org_id, is_owner, is_org_admin)
           VALUES (?, ?, ?, ?, 'PHARMACIST', ?, 0, 0)`,
          [pharmacistId, pharmacist_name.trim(), normalPharmacistEmail, hashedPharm, orgId],
        );
        await conn.execute(
          'INSERT INTO pharmacist_profiles (id, user_id) VALUES (?, ?)',
          [uuidv4(), pharmacistId],
        );
      }

      for (const r of DEFAULT_ROLES) {
        await conn.execute(
          `INSERT INTO roles (id, org_id, name, display_name, base_role, permissions, color)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), orgId, r.name, r.display_name, r.base_role, JSON.stringify(r.permissions), r.color],
        );
      }

      await conn.commit();
    } catch (err: any) {
      await conn.rollback();
      if (err.code === 'ER_DUP_ENTRY') throw AppError.conflict('Email already registered');
      throw err;
    } finally {
      conn.release();
    }

    return {
      message: 'Organization created',
      org: { id: orgId, name: org_name.trim(), plan: upperPlan },
      admin: { id: adminId, name: admin_name.trim(), email: normalAdminEmail },
      ...(hasPharmacist && { pharmacist: { id: pharmacistId, name: pharmacist_name.trim(), email: normalPharmacistEmail } }),
    };
  }

  async updateOrg(id: string, body: any) {
    await this.assertOrgExists(id);
    const { plan, status, name, address, phone, website } = body;
    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) {
      if (!name?.trim()) throw AppError.validation('Organization name cannot be empty');
      updates.push('name = ?'); params.push(name.trim());
    }
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status.toUpperCase())) throw AppError.validation(`Status must be one of: ${VALID_STATUSES.join(', ')}`);
      updates.push('status = ?'); params.push(status.toUpperCase());
    }
    if (address !== undefined) { updates.push('address = ?'); params.push(address?.trim() || null); }
    if (phone   !== undefined) { updates.push('phone = ?');   params.push(phone?.trim() || null); }
    if (website !== undefined) { updates.push('website = ?'); params.push(website?.trim() || null); }
    if (plan !== undefined) {
      const upperPlan = plan.toUpperCase();
      if (!PLAN_LIMITS[upperPlan]) throw AppError.validation(`Invalid plan`);
      const { prescription_limit, team_limit } = PLAN_LIMITS[upperPlan];
      updates.push('plan = ?', 'prescription_limit = ?', 'team_limit = ?');
      params.push(upperPlan, prescription_limit, team_limit);
    }

    if (updates.length === 0) throw AppError.badRequest('No valid fields provided');
    params.push(id);
    await this.pool.execute(`UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`, params);
    const [rows]: any = await this.pool.execute('SELECT * FROM organizations WHERE id = ?', [id]);
    return rows[0];
  }

  async deleteOrg(id: string) {
    await this.assertOrgExists(id);
    await this.pool.execute('DELETE FROM organizations WHERE id = ?', [id]);
    return { message: 'Organization deleted' };
  }

  async listUsers(query: { search?: string; org_id?: string }) {
    const { search, org_id } = query;
    let sql = `
      SELECT u.id, u.name, u.email, u.role, u.is_org_admin, u.created_at,
             o.name AS org_name, o.plan AS org_plan, r.display_name AS role_display_name
      FROM users u
      LEFT JOIN organizations o ON u.org_id = o.id
      LEFT JOIN roles r ON u.custom_role_id = r.id
      WHERE 1=1`;
    const params: any[] = [];
    if (search) {
      sql += ' AND (u.name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }
    if (org_id) { sql += ' AND u.org_id = ?'; params.push(org_id); }
    sql += ' ORDER BY u.created_at DESC LIMIT 100';
    const [users]: any = await this.pool.execute(sql, params);
    return users;
  }
}
