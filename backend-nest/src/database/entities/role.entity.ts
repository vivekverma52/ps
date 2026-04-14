import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Organization } from './organization.entity';
import { Hospital } from './hospital.entity';
import { UserRole } from './user-role.entity';

export interface RolePermissions {
  write_rx?:        boolean;
  read_rx?:         boolean;
  claim_rx?:        boolean;
  render_video?:    boolean;
  send_whatsapp?:   boolean;
  manage_staff?:    boolean;
  view_analytics?:  boolean;
  manage_hospital?: boolean;
}

@Entity('roles')
export class Role {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  org_id: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, comment: 'NULL = org-level role' })
  hospital_id: string | null;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  display_name: string;

  @Column({
    type: 'enum',
    enum: ['DOCTOR', 'PHARMACIST', 'VIEWER', 'ADMIN'],
    default: 'DOCTOR',
  })
  base_role: string;

  @Column({ type: 'json' })
  permissions: RolePermissions;

  @Column({ type: 'varchar', length: 20, default: '#1D9E75' })
  color: string;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  is_default: boolean;

  @Column({ type: 'tinyint', width: 1, default: 0, comment: '1 = cannot be deleted' })
  is_system: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  // ── Relations ──────────────────────────────────────────────────────────
  @ManyToOne(() => Organization, (org) => org.roles, { nullable: true })
  @JoinColumn({ name: 'org_id' })
  organization: Organization | null;

  @ManyToOne(() => Hospital, { nullable: true })
  @JoinColumn({ name: 'hospital_id' })
  hospital: Hospital | null;

  @OneToMany(() => UserRole, (ur) => ur.role)
  userRoles: UserRole[];
}
