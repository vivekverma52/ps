import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool } from 'mysql2/promise';
import { MYSQL_POOL } from '../../database/database.module';

@Injectable()
export class HospitalRepository {
  private readonly logger = new Logger(HospitalRepository.name);

  constructor(@Inject(MYSQL_POOL) private readonly pool: Pool) {}

  async getConnection() { return this.pool.getConnection(); }

  // ── Limit checks ──────────────────────────────────────────────────────

  async findOrgWithPlan(orgId: string) {
    this.logger.debug(`[findOrgWithPlan] orgId=${orgId}`);
    const [rows]: any = await this.pool.execute(
      `SELECT o.id, p.max_hospitals FROM organizations o LEFT JOIN plans p ON p.id = o.plan_id WHERE o.id = ?`,
      [orgId],
    );
    return (rows as any[])[0] ?? null;
  }

  async countHospitals(orgId: string): Promise<number> {
    const [[{ count }]]: any = await this.pool.execute(
      'SELECT COUNT(*) AS count FROM hospitals WHERE org_id = ?', [orgId],
    );
    return count as number;
  }

  async countStaff(orgId: string): Promise<number> {
    const [[{ count }]]: any = await this.pool.execute(
      'SELECT COUNT(*) AS count FROM users WHERE org_id = ?', [orgId],
    );
    return count as number;
  }

  async findOrgPlanStaffLimit(conn: any, orgId: string) {
    const [rows]: any = await conn.execute(
      `SELECT o.id, p.max_staff_per_hospital FROM organizations o LEFT JOIN plans p ON p.id = o.plan_id WHERE o.id = ?`,
      [orgId],
    );
    return (rows as any[])[0] ?? null;
  }

  // ── Hospitals ─────────────────────────────────────────────────────────

  async findHospitalInOrg(conn: any, orgId: string, slug: string) {
    const [rows]: any = await conn.execute(
      'SELECT id FROM hospitals WHERE org_id = ? AND slug = ?', [orgId, slug],
    );
    return (rows as any[])[0] ?? null;
  }

  async insertHospital(conn: any, id: string, orgId: string, name: string, slug: string) {
    this.logger.debug(`[insertHospital] orgId=${orgId} name=${name}`);
    await conn.execute(
      'INSERT INTO hospitals (id, org_id, name, slug) VALUES (?, ?, ?, ?)',
      [id, orgId, name, slug],
    );
  }

  async insertHospitalAddress(conn: any, params: {
    id: string; hospitalId: string; addressLine1: string; addressLine2: string | null;
    city: string; state: string | null; pincode: string | null;
  }) {
    await conn.execute(
      `INSERT INTO hospital_addresses (id, hospital_id, address_line1, address_line2, city, state, pincode)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [params.id, params.hospitalId, params.addressLine1, params.addressLine2,
       params.city, params.state, params.pincode],
    );
  }

  async findUserByEmailForLock(conn: any, email: string) {
    const [rows]: any = await conn.execute(
      'SELECT id FROM users WHERE email = ? FOR UPDATE', [email],
    );
    return (rows as any[])[0] ?? null;
  }

  async insertAdminUser(conn: any, params: {
    id: string; name: string; email: string; passwordHash: string;
    firstName: string; lastName: string; orgId: string; hospitalId: string;
  }) {
    await conn.execute(
      `INSERT INTO users (id, name, email, password_hash, first_name, last_name, role, status, org_id, hospital_id, is_org_admin)
       VALUES (?, ?, ?, ?, ?, ?, 'HOSPITAL_ADMIN', 'ACTIVE', ?, ?, 1)`,
      [params.id, params.name, params.email, params.passwordHash,
       params.firstName, params.lastName, params.orgId, params.hospitalId],
    );
  }

  async insertRole(conn: any, id: string, hospitalId: string, name: string, permissions: any) {
    await conn.execute(
      'INSERT INTO roles (id, hospital_id, name, permissions, is_system) VALUES (?, ?, ?, ?, 1)',
      [id, hospitalId, name, JSON.stringify(permissions)],
    );
  }

  async insertUserRole(conn: any, id: string, userId: string, roleId: string) {
    await conn.execute(
      'INSERT INTO user_roles (id, user_id, role_id, is_primary) VALUES (?, ?, ?, 1)',
      [id, userId, roleId],
    );
  }

  async listHospitals(orgId: string) {
    this.logger.debug(`[listHospitals] orgId=${orgId}`);
    const [rows]: any = await this.pool.execute(
      `SELECT h.*, ha.city, ha.state, ha.pincode, ha.lat, ha.lng, ha.address_line1
       FROM hospitals h LEFT JOIN hospital_addresses ha ON ha.hospital_id = h.id
       WHERE h.org_id = ? ORDER BY h.created_at ASC`,
      [orgId],
    );
    return rows;
  }

  async findHospitalById(orgId: string, hospitalId: string) {
    this.logger.debug(`[findHospitalById] hospitalId=${hospitalId}`);
    const [rows]: any = await this.pool.execute(
      `SELECT h.*, ha.city, ha.state, ha.pincode, ha.lat, ha.lng, ha.address_line1
       FROM hospitals h LEFT JOIN hospital_addresses ha ON ha.hospital_id = h.id
       WHERE h.id = ? AND h.org_id = ?`,
      [hospitalId, orgId],
    );
    return (rows as any[])[0] ?? null;
  }

  async updateHospital(hospitalId: string, fields: string[], values: any[]) {
    this.logger.debug(`[updateHospital] hospitalId=${hospitalId}`);
    await this.pool.execute(
      `UPDATE hospitals SET ${fields.join(', ')} WHERE id = ?`,
      [...values, hospitalId],
    );
  }

  async deleteHospital(hospitalId: string) {
    this.logger.debug(`[deleteHospital] hospitalId=${hospitalId}`);
    await this.pool.execute('DELETE FROM hospitals WHERE id = ?', [hospitalId]);
  }

  async upsertAddress(hospitalId: string, params: {
    addressLine1: string; addressLine2: string | null; city: string;
    state: string | null; pincode: string | null;
  }) {
    this.logger.debug(`[upsertAddress] hospitalId=${hospitalId}`);
    const [existing]: any = await this.pool.execute(
      'SELECT id FROM hospital_addresses WHERE hospital_id = ?', [hospitalId],
    );
    if ((existing as any[]).length > 0) {
      await this.pool.execute(
        `UPDATE hospital_addresses SET address_line1 = ?, address_line2 = ?, city = ?, state = ?, pincode = ? WHERE hospital_id = ?`,
        [params.addressLine1, params.addressLine2, params.city, params.state, params.pincode, hospitalId],
      );
    } else {
      const { v4: uuidv4 } = await import('uuid');
      await this.pool.execute(
        `INSERT INTO hospital_addresses (id, hospital_id, address_line1, address_line2, city, state, pincode)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), hospitalId, params.addressLine1, params.addressLine2, params.city, params.state, params.pincode],
      );
    }
  }

  // ── Staff ─────────────────────────────────────────────────────────────

  async listStaff(hospitalId: string) {
    this.logger.debug(`[listStaff] hospitalId=${hospitalId}`);
    const [rows]: any = await this.pool.execute(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.hospital_id, u.is_org_admin,
              ur.role_id, r.name AS role_name, r.permissions
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.is_primary = 1
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE u.hospital_id = ? ORDER BY u.is_org_admin DESC, u.created_at ASC`,
      [hospitalId],
    );
    return rows;
  }

  async addStaff(conn: any, params: {
    id: string; name: string; email: string; passwordHash: string;
    firstName: string; lastName: string; orgId: string; hospitalId: string; roleId: string | null;
  }) {
    await conn.execute(
      `INSERT INTO users (id, name, email, password_hash, first_name, last_name, role, status, org_id, hospital_id)
       VALUES (?, ?, ?, ?, ?, ?, 'PHARMACIST', 'ACTIVE', ?, ?)`,
      [params.id, params.name, params.email, params.passwordHash,
       params.firstName, params.lastName, params.orgId, params.hospitalId],
    );
  }

  async assignStaffRole(conn: any, id: string, userId: string, roleId: string) {
    await conn.execute(
      'INSERT INTO user_roles (id, user_id, role_id, is_primary) VALUES (?, ?, ?, 1)',
      [id, userId, roleId],
    );
  }

  async removeStaff(staffId: string) {
    this.logger.debug(`[removeStaff] staffId=${staffId}`);
    await this.pool.execute(
      'UPDATE users SET hospital_id = NULL, org_id = NULL WHERE id = ?', [staffId],
    );
  }
}
