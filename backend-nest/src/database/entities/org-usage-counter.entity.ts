import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from './organization.entity';
import { Hospital } from './hospital.entity';

@Entity('org_usage_counters')
export class OrgUsageCounter {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  org_id: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  hospital_id: string | null;

  @Column({ type: 'smallint' })
  rx_year: number;

  @Column({ type: 'tinyint' })
  rx_month: number;

  @Column({ type: 'int', unsigned: true, default: 0, comment: 'Rx within plan limit' })
  rx_count: number;

  @Column({ type: 'int', unsigned: true, default: 0, comment: 'Rx above plan limit' })
  overage_count: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  // ── Relations ──────────────────────────────────────────────────────────
  @ManyToOne(() => Organization, (org) => org.usageCounters)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => Hospital, (hospital) => hospital.usageCounters, { nullable: true })
  @JoinColumn({ name: 'hospital_id' })
  hospital: Hospital | null;
}
