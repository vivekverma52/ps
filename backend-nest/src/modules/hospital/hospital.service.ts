/**
 * HospitalService — Level 2
 * Covers: Hospitals · Hospital Addresses · Staff (doctor/pharmacist profiles)
 */
import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool } from 'mysql2/promise';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import { MYSQL_POOL } from '../../database/database.module';
import { AppError } from '../../common/errors/app.error';

const PASSWORD_MIN_LENGTH = 6;

// ── Row interfaces ────────────────────────────────────────────────────────────

export interface HospitalRow extends RowDataPacket {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  status: string;
  created_at: Date;
  city: string | null;
  state: string | null;
  pincode: string | null;
  lat: number | null;
  lng: number | null;
  address_line1: string | null;
}

export interface AddressRow extends RowDataPacket {
  id: string;
  hospital_id: string;
}

export interface UserRow extends RowDataPacket {
  id: string;
  role: string;
  email?: string;
  name?: string;
  status?: string;
}

export interface CountRow extends RowDataPacket {
  count: number;
}

export interface OrgPlanRow extends RowDataPacket {
  id: string;
  max_hospitals: number | null;
  max_staff_per_hospital: number | null;
}

export interface DoctorProfileRow extends RowDataPacket {
  id: string;
  user_id: string;
  hospital_id: string | null;
  specialization: string | null;
  license_number: string | null;
  registration_number: string | null;
  role_id: string | null;
  name: string;
  email: string;
  status: string;
  hospital_name: string | null;
  hospital_slug: string | null;
  role_display_name: string | null;
  role_color: string | null;
}

export interface PharmacistProfileRow extends RowDataPacket {
  id: string;
  user_id: string;
  hospital_id: string | null;
  license_number: string | null;
  pharmacy_registration: string | null;
  role_id: string | null;
  name: string;
  email: string;
  status: string;
  hospital_name: string | null;
  hospital_slug: string | null;
  role_display_name: string | null;
  role_color: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

type SqlValue = string | number | boolean | null;

function buildDynamicUpdate(
  dto: Record<string, SqlValue>,
  columnMap: Record<string, string>,
): { fields: string[]; values: SqlValue[] } {
  const fields: string[]    = [];
  const values: SqlValue[]  = [];
  for (const [key, col] of Object.entries(columnMap)) {
    if (dto[key] !== undefined) {
      fields.push(`${col} = ?`);
      values.push(dto[key]);
    }
  }
  return { fields, values };
}

@Injectable()
export class HospitalService {
  private readonly logger = new Logger(HospitalService.name);

  constructor(
    @Inject(MYSQL_POOL) private readonly pool: Pool,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────

  private async assertBelongsToOrg(hospitalId: string, orgId: string) {
    const [rows] = await this.pool.execute<HospitalRow[]>(
      'SELECT id FROM hospitals WHERE id = ? AND org_id = ?', [hospitalId, orgId],
    );
    if (rows.length === 0) throw AppError.notFound('Hospital');
  }

  private async assertHospitalLimit(orgId: string) {
    const [orgRows] = await this.pool.execute<OrgPlanRow[]>(
      `SELECT o.id, p.max_hospitals
       FROM organizations o
       LEFT JOIN plans p ON p.id = o.plan_id
       WHERE o.id = ?`,
      [orgId],
    );
    if (orgRows.length === 0) throw AppError.notFound('Organization');
    const limit = orgRows[0].max_hospitals ?? 0;
    if (limit === 0) return;
    const [[{ count }]] = await this.pool.execute<CountRow[]>('SELECT COUNT(*) AS count FROM hospitals WHERE org_id = ?', [orgId]);
    if (count >= limit) {
      throw new AppError(`Hospital limit reached (${limit}). Please upgrade your plan.`, 403, 'HOSPITAL_LIMIT_EXCEEDED');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HOSPITALS
  // ═══════════════════════════════════════════════════════════════════════

  async createHospital(orgId: string, dto: {
    name: string;
    phone?: string;
    email?: string;
    // Address (required on create)
    address_line1: string;
    address_line2?: string;
    city: string;
    state?: string;
    pincode?: string;
    // Admin credentials (required on create)
    admin_name: string;
    admin_email: string;
    admin_password: string;
  }) {
    this.logger.log(`[createHospital] orgId=${orgId} name=${dto.name} adminEmail=${dto.admin_email}`);
    await this.assertHospitalLimit(orgId);

    // Validate required fields up-front, before touching the DB
    if (!dto.address_line1?.trim()) throw AppError.badRequest('Address line is required');
    if (!dto.city?.trim())         throw AppError.badRequest('City is required');
    if (!dto.admin_name?.trim())   throw AppError.badRequest('Admin name is required');
    if (!dto.admin_email?.trim())  throw AppError.badRequest('Admin email is required');
    if (!dto.admin_password || dto.admin_password.length < PASSWORD_MIN_LENGTH)
      throw AppError.badRequest(`Admin password must be at least ${PASSWORD_MIN_LENGTH} characters`);

    // Bcrypt is CPU-bound — compute before entering the transaction so we don't
    // hold a DB connection open during the ~100 ms hash operation.
    const normalEmail = dto.admin_email.trim().toLowerCase();
    const hashed      = await bcrypt.hash(dto.admin_password, 10);

    const hospitalId        = uuidv4();
    const adminId           = uuidv4();
    const hospitalAdminRoleId = uuidv4();

    const defaultRoles = [
      { id: hospitalAdminRoleId, name: 'Hospital Admin', permissions: { write_rx: false, read_rx: true, claim_rx: false, render_video: false, manage_staff: true, view_analytics: true, manage_hospital: true } },
      { id: uuidv4(),            name: 'Doctor',         permissions: { write_rx: true,  read_rx: true,  claim_rx: false, render_video: false, manage_staff: false, view_analytics: false, manage_hospital: false } },
      { id: uuidv4(),            name: 'Pharmacist',     permissions: { write_rx: false, read_rx: true,  claim_rx: true,  render_video: true,  manage_staff: false, view_analytics: false, manage_hospital: false } },
    ];

    const nameParts = dto.admin_name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName  = nameParts.slice(1).join(' ') || '';

    // ── All DB writes in one atomic transaction ───────────────────────────
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Team-limit check — inside the transaction, serialised with INSERT
      const [orgPlanRows] = await conn.execute<OrgPlanRow[]>(
        `SELECT o.id, p.max_staff_per_hospital
         FROM organizations o LEFT JOIN plans p ON p.id = o.plan_id
         WHERE o.id = ?`,
        [orgId],
      );
      const [[{ count: staffCount }]] = await conn.execute<CountRow[]>(
        'SELECT COUNT(*) AS count FROM users WHERE org_id = ?', [orgId],
      );
      const staffLimit = orgPlanRows[0]?.max_staff_per_hospital ?? 0;
      if (staffLimit > 0 && staffCount >= staffLimit) {
        throw new AppError(`Team limit reached (${staffLimit} members). Please upgrade your plan.`, 403, 'TEAM_LIMIT_EXCEEDED');
      }

      // 2. Email uniqueness — FOR UPDATE prevents a concurrent registration
      //    slipping through between our check and the INSERT
      const [emailCheck] = await conn.execute<UserRow[]>(
        'SELECT id FROM users WHERE email = ? FOR UPDATE', [normalEmail],
      );
      if (emailCheck.length > 0) throw AppError.conflict('A user with this admin email already exists');

      // 3. Slug — unique within the org
      let slug = slugify(dto.name);
      const [existingSlug] = await conn.execute<HospitalRow[]>(
        'SELECT id FROM hospitals WHERE org_id = ? AND slug = ?', [orgId, slug],
      );
      if (existingSlug.length > 0) slug = `${slug}-${Date.now()}`;

      // 4. Hospital row
      await conn.execute(
        'INSERT INTO hospitals (id, org_id, name, slug) VALUES (?, ?, ?, ?)',
        [hospitalId, orgId, dto.name.trim(), slug],
      );

      // 5. Address
      await conn.execute(
        `INSERT INTO hospital_addresses
           (id, hospital_id, address_line1, address_line2, city, state, pincode)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), hospitalId,
         dto.address_line1.trim(), dto.address_line2?.trim() ?? null,
         dto.city.trim(), dto.state?.trim() ?? null, dto.pincode?.trim() ?? null],
      );

      // 6. Admin user — password_hash only, never store plain password
      await conn.execute(
        `INSERT INTO users
           (id, name, email, password_hash, first_name, last_name,
            role, status, org_id, hospital_id, is_org_admin)
         VALUES (?, ?, ?, ?, ?, ?, 'HOSPITAL_ADMIN', 'ACTIVE', ?, ?, 1)`,
        [adminId, dto.admin_name.trim(), normalEmail, hashed,
         firstName, lastName, orgId, hospitalId],
      );

      // 7. Default system roles for this hospital
      for (const r of defaultRoles) {
        await conn.execute(
          'INSERT INTO roles (id, hospital_id, name, permissions, is_system) VALUES (?, ?, ?, ?, 1)',
          [r.id, hospitalId, r.name, JSON.stringify(r.permissions)],
        );
      }

      // 8. Assign Hospital Admin role to the new admin user
      await conn.execute(
        'INSERT INTO user_roles (id, user_id, role_id, is_primary) VALUES (?, ?, ?, 1)',
        [uuidv4(), adminId, hospitalAdminRoleId],
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    return this.getHospitalById(orgId, hospitalId);
  }

  async listHospitals(orgId: string) {
    this.logger.log(`[listHospitals] orgId=${orgId}`);
    const [rows] = await this.pool.execute<HospitalRow[]>(
      `SELECT h.*, ha.city, ha.state, ha.pincode, ha.lat, ha.lng, ha.address_line1
       FROM hospitals h
       LEFT JOIN hospital_addresses ha ON ha.hospital_id = h.id
       WHERE h.org_id = ? ORDER BY h.created_at ASC`,
      [orgId],
    );
    return rows;
  }

  async getHospitalById(orgId: string, hospitalId: string) {
    const [rows] = await this.pool.execute<HospitalRow[]>(
      `SELECT h.*, ha.city, ha.state, ha.pincode, ha.lat, ha.lng, ha.address_line1
       FROM hospitals h
       LEFT JOIN hospital_addresses ha ON ha.hospital_id = h.id
       WHERE h.id = ? AND h.org_id = ?`,
      [hospitalId, orgId],
    );
    if (rows.length === 0) throw AppError.notFound('Hospital');
    return rows[0];
  }

  async updateHospital(orgId: string, hospitalId: string, dto: { name?: string; phone?: string; email?: string; status?: 'ACTIVE' | 'SUSPENDED' }) {
    await this.assertBelongsToOrg(hospitalId, orgId);
    const trimmed = dto.name !== undefined ? { ...dto, name: dto.name.trim() } : dto;
    const { fields, values } = buildDynamicUpdate(trimmed as Record<string, SqlValue>, { name: 'name', phone: 'phone', email: 'email', status: 'status' });
    if (fields.length === 0) throw AppError.badRequest('No fields to update');
    await this.pool.execute(`UPDATE hospitals SET ${fields.join(', ')} WHERE id = ?`, [...values, hospitalId]);
    return this.getHospitalById(orgId, hospitalId);
  }

  async removeHospital(orgId: string, hospitalId: string) {
    await this.assertBelongsToOrg(hospitalId, orgId);

    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Delete prescriptions for this hospital
      await conn.execute('DELETE FROM prescriptions WHERE hospital_id = ?', [hospitalId]);

      // 2. Collect all user IDs linked to this hospital (via users.hospital_id OR doctor/pharmacist profiles)
      const [directUsers]    = await conn.execute<UserRow[]>('SELECT id FROM users WHERE hospital_id = ?', [hospitalId]);
      const [doctorUsers]    = await conn.execute<UserRow[]>('SELECT user_id AS id FROM doctor_profiles WHERE hospital_id = ?', [hospitalId]);
      const [pharmacistUsers] = await conn.execute<UserRow[]>('SELECT user_id AS id FROM pharmacist_profiles WHERE hospital_id = ?', [hospitalId]);

      const userIds = [
        ...directUsers.map(u => u.id),
        ...doctorUsers.map(u => u.id),
        ...pharmacistUsers.map(u => u.id),
      ];
      const uniqueUserIds = [...new Set(userIds)];

      // 3. Delete hospital-scoped users
      //    Cascades automatically: user_roles, refresh_tokens, doctor_profiles, pharmacist_profiles
      if (uniqueUserIds.length > 0) {
        const placeholders = uniqueUserIds.map(() => '?').join(',');
        await conn.execute(`DELETE FROM users WHERE id IN (${placeholders})`, uniqueUserIds);
      }

      // 4. Delete the hospital — DB cascades handle: hospital_addresses (lat/lng map data), roles, user_roles
      await conn.execute('DELETE FROM hospitals WHERE id = ?', [hospitalId]);

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    return { message: 'Hospital deleted' };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HOSPITAL ADDRESS (upsert)
  // ═══════════════════════════════════════════════════════════════════════

  async upsertAddress(orgId: string, hospitalId: string, dto: {
    address_line1?: string; address_line2?: string; city?: string; state?: string; pincode?: string; lat?: number; lng?: number;
  }) {
    await this.assertBelongsToOrg(hospitalId, orgId);
    const [existing] = await this.pool.execute<AddressRow[]>(
      'SELECT id FROM hospital_addresses WHERE hospital_id = ?', [hospitalId],
    );

    if (existing.length > 0) {
      const { fields, values } = buildDynamicUpdate(dto as Record<string, SqlValue>, {
        address_line1: 'address_line1', address_line2: 'address_line2',
        city: 'city', state: 'state', pincode: 'pincode', lat: 'lat', lng: 'lng',
      });
      if (fields.length > 0) {
        await this.pool.execute(`UPDATE hospital_addresses SET ${fields.join(', ')} WHERE hospital_id = ?`, [...values, hospitalId]);
      }
    } else {
      await this.pool.execute(
        `INSERT INTO hospital_addresses (id, hospital_id, address_line1, address_line2, city, state, pincode, lat, lng)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), hospitalId, dto.address_line1 ?? null, dto.address_line2 ?? null,
         dto.city ?? null, dto.state ?? null, dto.pincode ?? null, dto.lat ?? null, dto.lng ?? null],
      );
    }
    return this.getHospitalById(orgId, hospitalId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STAFF — doctor & pharmacist profiles linked to hospital
  // ═══════════════════════════════════════════════════════════════════════

  async getStaff(orgId: string, hospitalId: string) {
    await this.assertBelongsToOrg(hospitalId, orgId);
    const [doctors] = await this.pool.execute<DoctorProfileRow[]>(
      `SELECT u.id, u.name, u.email, u.status, 'DOCTOR' AS profile_type,
              r.display_name AS role_display_name, r.color AS role_color,
              dp.specialization, dp.license_number
       FROM doctor_profiles dp
       JOIN users u ON u.id = dp.user_id
       LEFT JOIN roles r ON r.id = dp.role_id
       WHERE dp.hospital_id = ?`,
      [hospitalId],
    );
    const [pharmacists] = await this.pool.execute<PharmacistProfileRow[]>(
      `SELECT u.id, u.name, u.email, u.status, 'PHARMACIST' AS profile_type,
              r.display_name AS role_display_name, r.color AS role_color, pp.license_number
       FROM pharmacist_profiles pp
       JOIN users u ON u.id = pp.user_id
       LEFT JOIN roles r ON r.id = pp.role_id
       WHERE pp.hospital_id = ?`,
      [hospitalId],
    );
    return { doctors, pharmacists };
  }

  async getDoctorProfile(userId: string) {
    const [rows] = await this.pool.execute<DoctorProfileRow[]>(
      `SELECT dp.*, u.name, u.email, u.status,
              h.name AS hospital_name, h.slug AS hospital_slug,
              r.display_name AS role_display_name, r.color AS role_color
       FROM doctor_profiles dp
       JOIN users u ON u.id = dp.user_id
       LEFT JOIN hospitals h ON h.id = dp.hospital_id
       LEFT JOIN roles r ON r.id = dp.role_id
       WHERE dp.user_id = ?`,
      [userId],
    );
    if (rows.length === 0) throw AppError.notFound('Doctor profile');
    return rows[0];
  }

  async updateDoctorProfile(userId: string, dto: { hospital_id?: string; role_id?: string; specialization?: string; license_number?: string; registration_number?: string }) {
    await this.getDoctorProfile(userId);
    const { fields, values } = buildDynamicUpdate(dto as Record<string, SqlValue>, {
      hospital_id: 'hospital_id', role_id: 'role_id', specialization: 'specialization',
      license_number: 'license_number', registration_number: 'registration_number',
    });
    if (fields.length === 0) throw AppError.badRequest('No fields to update');
    await this.pool.execute(`UPDATE doctor_profiles SET ${fields.join(', ')} WHERE user_id = ?`, [...values, userId]);
    return this.getDoctorProfile(userId);
  }

  async getPharmacistProfile(userId: string) {
    const [rows] = await this.pool.execute<PharmacistProfileRow[]>(
      `SELECT pp.*, u.name, u.email, u.status,
              h.name AS hospital_name, h.slug AS hospital_slug,
              r.display_name AS role_display_name, r.color AS role_color
       FROM pharmacist_profiles pp
       JOIN users u ON u.id = pp.user_id
       LEFT JOIN hospitals h ON h.id = pp.hospital_id
       LEFT JOIN roles r ON r.id = pp.role_id
       WHERE pp.user_id = ?`,
      [userId],
    );
    if (rows.length === 0) throw AppError.notFound('Pharmacist profile');
    return rows[0];
  }

  async updatePharmacistProfile(userId: string, dto: { hospital_id?: string; role_id?: string; license_number?: string; pharmacy_registration?: string }) {
    await this.getPharmacistProfile(userId);
    const { fields, values } = buildDynamicUpdate(dto as Record<string, SqlValue>, {
      hospital_id: 'hospital_id', role_id: 'role_id',
      license_number: 'license_number', pharmacy_registration: 'pharmacy_registration',
    });
    if (fields.length === 0) throw AppError.badRequest('No fields to update');
    await this.pool.execute(`UPDATE pharmacist_profiles SET ${fields.join(', ')} WHERE user_id = ?`, [...values, userId]);
    return this.getPharmacistProfile(userId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ADMIN: create a new doctor/pharmacist and assign to hospital in one step
  // ═══════════════════════════════════════════════════════════════════════

  async createMemberForHospital(
    orgId: string,
    hospitalId: string,
    body: { name: string; email: string; password: string; role: 'DOCTOR' | 'PHARMACIST' },
  ) {
    await this.assertBelongsToOrg(hospitalId, orgId);

    const { name, email, password, role } = body;
    if (!name || !email || !password || !role) throw AppError.badRequest('name, email, password and role are required');
    const upperRole = role.toUpperCase();
    if (!['DOCTOR', 'PHARMACIST'].includes(upperRole)) throw AppError.badRequest('Role must be DOCTOR or PHARMACIST');
    if (password.length < PASSWORD_MIN_LENGTH) throw AppError.badRequest(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    if (name.trim().length < 2) throw AppError.badRequest('Name must be at least 2 characters');

    // Check team limit
    const [orgRows] = await this.pool.execute<OrgPlanRow[]>(
      `SELECT o.id, p.max_staff_per_hospital
       FROM organizations o LEFT JOIN plans p ON p.id = o.plan_id
       WHERE o.id = ?`,
      [orgId],
    );
    const org = orgRows[0];
    const [[{ count }]] = await this.pool.execute<CountRow[]>('SELECT COUNT(*) AS count FROM users WHERE org_id = ?', [orgId]);
    const staffLimit = org?.max_staff_per_hospital ?? 0;
    if (staffLimit > 0 && count >= staffLimit) {
      throw new AppError(`Team limit reached (${staffLimit} members). Please upgrade your plan.`, 403, 'TEAM_LIMIT_EXCEEDED');
    }

    const normalEmail = email.trim().toLowerCase();
    // Bcrypt before the transaction — don't hold a connection during CPU work
    const hashed    = await bcrypt.hash(password, 10);
    const memberId  = uuidv4();
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName  = nameParts.slice(1).join(' ') || '';

    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      // Email uniqueness — FOR UPDATE serialises concurrent registrations
      const [existing] = await conn.execute<UserRow[]>(
        'SELECT id FROM users WHERE email = ? FOR UPDATE', [normalEmail],
      );
      if (existing.length > 0) throw AppError.conflict('A user with this email already exists');

      await conn.execute(
        `INSERT INTO users
           (id, name, email, password_hash, first_name, last_name,
            role, org_id, hospital_id, is_owner, is_org_admin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        [memberId, name.trim(), normalEmail, hashed, firstName, lastName,
         upperRole, orgId, hospitalId],
      );

      if (upperRole === 'DOCTOR') {
        await conn.execute(
          'INSERT INTO doctor_profiles (id, user_id, hospital_id) VALUES (?, ?, ?)',
          [uuidv4(), memberId, hospitalId],
        );
      } else {
        await conn.execute(
          'INSERT INTO pharmacist_profiles (id, user_id, hospital_id) VALUES (?, ?, ?)',
          [uuidv4(), memberId, hospitalId],
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    return { id: memberId, name: name.trim(), email: normalEmail, role: upperRole, hospital_id: hospitalId };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ADMIN: assign / remove staff from hospital
  // ═══════════════════════════════════════════════════════════════════════

  async assignStaffToHospital(orgId: string, hospitalId: string, userId: string) {
    await this.assertBelongsToOrg(hospitalId, orgId);
    // Verify user belongs to this org
    const [userRows] = await this.pool.execute<UserRow[]>(
      'SELECT id, role FROM users WHERE id = ? AND org_id = ?', [userId, orgId],
    );
    if (userRows.length === 0) throw AppError.notFound('User not found in this organization');
    const role = userRows[0].role;
    if (role === 'DOCTOR') {
      await this.pool.execute('UPDATE doctor_profiles SET hospital_id = ? WHERE user_id = ?', [hospitalId, userId]);
    } else if (role === 'PHARMACIST') {
      await this.pool.execute('UPDATE pharmacist_profiles SET hospital_id = ? WHERE user_id = ?', [hospitalId, userId]);
    } else {
      throw AppError.badRequest('Only DOCTOR or PHARMACIST can be assigned to a hospital');
    }
    return { message: 'Staff assigned to hospital' };
  }

  async removeStaffFromHospital(orgId: string, hospitalId: string, userId: string) {
    await this.assertBelongsToOrg(hospitalId, orgId);
    const [userRows] = await this.pool.execute<UserRow[]>(
      'SELECT id, role FROM users WHERE id = ? AND org_id = ?', [userId, orgId],
    );
    if (userRows.length === 0) throw AppError.notFound('User not found in this organization');
    const role = userRows[0].role;
    if (role === 'DOCTOR') {
      await this.pool.execute('UPDATE doctor_profiles SET hospital_id = NULL WHERE user_id = ? AND hospital_id = ?', [userId, hospitalId]);
    } else if (role === 'PHARMACIST') {
      await this.pool.execute('UPDATE pharmacist_profiles SET hospital_id = NULL WHERE user_id = ? AND hospital_id = ?', [userId, hospitalId]);
    } else {
      throw AppError.badRequest('Only DOCTOR or PHARMACIST can be removed from a hospital');
    }
    return { message: 'Staff removed from hospital' };
  }

  async getDoctorsByHospital(hospitalId: string) {
    const [rows] = await this.pool.execute<DoctorProfileRow[]>(
      `SELECT dp.*, u.name, u.email, u.status, r.display_name AS role_display_name, r.color AS role_color
       FROM doctor_profiles dp
       JOIN users u ON u.id = dp.user_id
       LEFT JOIN roles r ON r.id = dp.role_id
       WHERE dp.hospital_id = ? ORDER BY u.name ASC`,
      [hospitalId],
    );
    return rows;
  }

  async getPharmacistsByHospital(hospitalId: string) {
    const [rows] = await this.pool.execute<PharmacistProfileRow[]>(
      `SELECT pp.*, u.name, u.email, u.status, r.display_name AS role_display_name, r.color AS role_color
       FROM pharmacist_profiles pp
       JOIN users u ON u.id = pp.user_id
       LEFT JOIN roles r ON r.id = pp.role_id
       WHERE pp.hospital_id = ? ORDER BY u.name ASC`,
      [hospitalId],
    );
    return rows;
  }
}
