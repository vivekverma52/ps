import { Entity, PrimaryColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Organization } from './organization.entity';

export type PlanName = 'FREE' | 'PRO' | 'GROWTH' | 'ENTERPRISE';

@Entity('plans')
export class Plan {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 100 })
  display_name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.00 })
  price_monthly: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.00 })
  price_yearly: number;

  @Column({ type: 'int', default: 1, comment: '0 = unlimited' })
  max_hospitals: number;

  @Column({ type: 'int', default: 2, comment: '0 = unlimited' })
  max_staff_per_hospital: number;

  @Column({ type: 'int', default: 30, comment: '0 = unlimited' })
  max_rx_per_month: number;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  ocr_enabled: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0.00 })
  overage_price_per_rx: number;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  // ── Relations ──────────────────────────────────────────────────────────
  @OneToMany(() => Organization, (org) => org.plan)
  organizations: Organization[];
}
