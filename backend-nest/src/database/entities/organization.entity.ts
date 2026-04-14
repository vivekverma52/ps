import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Plan } from './plan.entity';
import { User } from './user.entity';
import { Hospital } from './hospital.entity';
import { Role } from './role.entity';
import { OrgUsageCounter } from './org-usage-counter.entity';

export type OrgStatus    = 'ACTIVE' | 'SUSPENDED' | 'TRIAL';
export type BillingCycle = 'MONTHLY' | 'YEARLY';

@Entity('organizations')
export class Organization {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  owner_id: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  plan_id: string | null;

  @Column({ type: 'enum', enum: ['MONTHLY', 'YEARLY'], default: 'MONTHLY' })
  billing_cycle: BillingCycle;

  @Column({ type: 'timestamp', nullable: true })
  plan_started_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  plan_expires_at: Date | null;

  @Column({ type: 'enum', enum: ['ACTIVE', 'SUSPENDED', 'TRIAL'], default: 'TRIAL' })
  status: OrgStatus;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, comment: 'GST registration number' })
  gstin: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: 'S3 object key' })
  logo_key: string | null;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  // ── Relations ──────────────────────────────────────────────────────────
  @ManyToOne(() => Plan, (plan) => plan.organizations, { nullable: true })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_id' })
  owner: User | null;

  @OneToMany(() => Hospital, (hospital) => hospital.organization)
  hospitals: Hospital[];

  @OneToMany(() => User, (user) => user.organization)
  users: User[];

  @OneToMany(() => Role, (role) => role.organization)
  roles: Role[];

  @OneToMany(() => OrgUsageCounter, (counter) => counter.organization)
  usageCounters: OrgUsageCounter[];
}
