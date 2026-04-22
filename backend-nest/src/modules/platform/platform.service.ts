/**
 * PlatformService — Level 0
 * Covers: Superadmin management + Plans table
 */
import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Pool } from 'mysql2/promise';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { MYSQL_POOL } from '../../database/database.module';
import { AppError } from '../../common/errors/app.error';
import { PlatformRepository } from './platform.repository';
import { Prescription, PrescriptionDocument } from '../prescription/schemas/prescription.schema';

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
    @InjectModel(Prescription.name) private readonly prescriptionModel: Model<PrescriptionDocument>,
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
    max_prescriptions_per_month: number;
    max_staff_per_hospital: number;
    max_hospitals: number;
    price?: number;
    features?: Record<string, any>;
  }) {
    const upper = dto.name.toUpperCase();
    const [existing]: any = await this.pool.execute('SELECT id FROM plans WHERE name = ?', [upper]);
    if (existing.length > 0) throw AppError.conflict('Plan with this name already exists');

    const id   = uuidv4();
    const slug = upper.toLowerCase() + '-' + crypto.randomBytes(3).toString('hex');
    await this.pool.execute(
      `INSERT INTO plans (id, name, slug, max_prescriptions_per_month, max_staff_per_hospital, max_hospitals, price, features)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, upper, slug, dto.max_prescriptions_per_month, dto.max_staff_per_hospital, dto.max_hospitals,
       dto.price ?? 0, dto.features ? JSON.stringify(dto.features) : null],
    );
    return this.getPlanById(id);
  }

  async updatePlan(id: string, dto: Partial<{ max_prescriptions_per_month: number; max_staff_per_hospital: number; max_hospitals: number; price: number; features: any }>) {
    await this.getPlanById(id);
    const fields: string[] = [];
    const values: any[] = [];
    if (dto.max_prescriptions_per_month !== undefined) { fields.push('max_prescriptions_per_month = ?'); values.push(dto.max_prescriptions_per_month); }
    if (dto.max_staff_per_hospital      !== undefined) { fields.push('max_staff_per_hospital = ?');      values.push(dto.max_staff_per_hospital); }
    if (dto.max_hospitals               !== undefined) { fields.push('max_hospitals = ?');               values.push(dto.max_hospitals); }
    if (dto.price                       !== undefined) { fields.push('price = ?');                       values.push(dto.price); }
    if (dto.features                    !== undefined) { fields.push('features = ?');                    values.push(JSON.stringify(dto.features)); }
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
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [
      [orgStats], [userStats],
      totalPrescriptions, prescriptionsThisMonth,
    ]: any = await Promise.all([
      this.pool.execute(
        `SELECT COUNT(*) AS total, SUM(status = 'ACTIVE') AS active, SUM(status = 'SUSPENDED') AS suspended FROM organizations`,
      ).then(([rows]: any) => rows),
      this.pool.execute('SELECT COUNT(*) AS total FROM users').then(([rows]: any) => rows),
      this.prescriptionModel.countDocuments({}),
      this.prescriptionModel.countDocuments({ created_at: { $gte: startOfMonth, $lt: endOfMonth } }),
    ]);

    const [recentOrgs]: any = await this.pool.execute(
      `SELECT o.*, COALESCE(uc.user_count, 0) AS user_count
       FROM organizations o
       LEFT JOIN (SELECT org_id, COUNT(*) AS user_count FROM users GROUP BY org_id) uc ON uc.org_id = o.id
       ORDER BY o.created_at DESC LIMIT 5`,
    );

    const orgIds = (recentOrgs as any[]).map((o: any) => o.id);
    const prescCounts = await this.prescriptionModel.aggregate([
      { $match: { org_id: { $in: orgIds } } },
      { $group: { _id: '$org_id', count: { $sum: 1 } } },
    ]);
    const prescCountMap = new Map(prescCounts.map((p: any) => [p._id, p.count]));

    return {
      stats: {
        total_orgs: orgStats.total, active_orgs: orgStats.active || 0,
        suspended_orgs: orgStats.suspended || 0, total_users: userStats.total,
        total_prescriptions: totalPrescriptions, prescriptions_this_month: prescriptionsThisMonth,
      },
      recent_orgs: (recentOrgs as any[]).map((o: any) => ({
        ...o, prescription_count: prescCountMap.get(o.id) ?? 0,
      })),
    };
  }

  async listOrgs(query: { search?: string; plan?: string; status?: string }) {
    this.logger.log(`[listOrgs] search=${query.search} plan=${query.plan} status=${query.status}`);
    const { search, plan, status } = query;
    if (status && !VALID_STATUSES.includes(status.toUpperCase())) throw AppError.validation('Invalid status filter');

    let sql = `
      SELECT o.*,
        COALESCE(p.name, 'FREE')   AS plan_name,
        COALESCE(uc.user_count, 0) AS user_count,
        owner.name                 AS owner_name,
        owner.email                AS owner_email
      FROM organizations o
      LEFT JOIN plans p ON p.id = o.plan_id
      LEFT JOIN (SELECT org_id, COUNT(*) AS user_count FROM users GROUP BY org_id) uc ON uc.org_id = o.id
      LEFT JOIN users owner ON owner.id = o.owner_id
      WHERE 1=1`;
    const params: any[] = [];
    if (search) { sql += ' AND o.name LIKE ?'; params.push(`%${search.trim()}%`); }
    if (plan)   { sql += ' AND p.name = ?';    params.push(plan.toUpperCase()); }
    if (status) { sql += ' AND o.status = ?';  params.push(status.toUpperCase()); }
    sql += ' ORDER BY o.created_at DESC LIMIT 200';

    const [orgs]: any = await this.pool.execute(sql, params);

    const orgIds = (orgs as any[]).map((o: any) => o.id);
    if (orgIds.length === 0) return orgs;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [allCounts, monthCounts] = await Promise.all([
      this.prescriptionModel.aggregate([
        { $match: { org_id: { $in: orgIds } } },
        { $group: { _id: '$org_id', count: { $sum: 1 } } },
      ]),
      this.prescriptionModel.aggregate([
        { $match: { org_id: { $in: orgIds }, created_at: { $gte: startOfMonth, $lt: endOfMonth } } },
        { $group: { _id: '$org_id', count: { $sum: 1 } } },
      ]),
    ]);
    const allMap   = new Map(allCounts.map((p: any)   => [p._id, p.count]));
    const monthMap = new Map(monthCounts.map((p: any) => [p._id, p.count]));

    return (orgs as any[]).map((o: any) => ({
      ...o,
      prescription_count:        allMap.get(o.id)   ?? 0,
      prescriptions_this_month:  monthMap.get(o.id) ?? 0,
    }));
  }

  async getOrgDetail(id: string) {
    await this.assertOrgExists(id);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [[orgs], [members], [roles], prescription_count, prescriptions_this_month, recent_prescriptions] =
      await Promise.all([
        this.pool.execute(
          `SELECT o.*,
             (SELECT COUNT(*) FROM users u WHERE u.org_id = o.id) AS user_count,
             (SELECT u.name  FROM users u WHERE u.id = o.owner_id LIMIT 1) AS owner_name,
             (SELECT u.email FROM users u WHERE u.id = o.owner_id LIMIT 1) AS owner_email
           FROM organizations o WHERE o.id = ?`,
          [id],
        ),
        this.pool.execute(
          `SELECT u.id, u.name, u.email, u.role, u.is_owner, u.is_org_admin, u.created_at,
                  r.display_name AS role_display_name, r.color AS role_color
           FROM users u LEFT JOIN roles r ON u.custom_role_id = r.id
           WHERE u.org_id = ? ORDER BY u.is_owner DESC, u.created_at ASC`,
          [id],
        ),
        this.pool.execute('SELECT * FROM roles WHERE org_id = ? ORDER BY created_at ASC', [id]),
        this.prescriptionModel.countDocuments({ org_id: id }),
        this.prescriptionModel.countDocuments({ org_id: id, created_at: { $gte: startOfMonth, $lt: endOfMonth } }),
        this.prescriptionModel
          .find({ org_id: id }, { patient_name: 1, doctor_name: 1, status: 1, created_at: 1 })
          .sort({ created_at: -1 })
          .limit(10)
          .lean(),
      ]);

    return {
      ...(orgs as any[])[0],
      prescription_count,
      prescriptions_this_month,
      users: members,
      roles,
      recent_prescriptions,
    };
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

    const orgId         = uuidv4();
    const adminId       = uuidv4();
    const pharmacistId  = hasPharmacist ? uuidv4() : null;
    const hashedAdmin   = await bcrypt.hash(admin_password, 10);
    const hashedPharm   = hasPharmacist ? await bcrypt.hash(pharmacist_password, 10) : null;

    // Resolve plan_id — look up the plans table (null is fine if FREE plan not seeded yet)
    const [planRows]: any = await this.pool.execute('SELECT id FROM plans WHERE name = ? LIMIT 1', [upperPlan]);
    const planId: string | null = planRows.length > 0 ? planRows[0].id : null;

    const conn = await (this.pool as any).getConnection();
    try {
      await conn.beginTransaction();

      await conn.execute(
        `INSERT INTO organizations (id, name, slug, plan_id, owner_id, address, phone, website)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orgId, org_name.trim(), slugify(org_name), planId,
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
      const [planRows]: any = await this.pool.execute('SELECT id FROM plans WHERE name = ? LIMIT 1', [upperPlan]);
      const newPlanId: string | null = planRows.length > 0 ? planRows[0].id : null;
      updates.push('plan_id = ?');
      params.push(newPlanId);
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
             o.name AS org_name, COALESCE(p.name, 'FREE') AS org_plan, r.display_name AS role_display_name
      FROM users u
      LEFT JOIN organizations o ON u.org_id = o.id
      LEFT JOIN plans p ON p.id = o.plan_id
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
