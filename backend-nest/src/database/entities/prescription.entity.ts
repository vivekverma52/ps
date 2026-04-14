import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from './organization.entity';
import { Hospital } from './hospital.entity';
import { User } from './user.entity';

export type PrescriptionStatus = 'UPLOADED' | 'CLAIMED' | 'PROCESSING' | 'RENDERED' | 'SENT';

export interface InterpretedMedicine {
  name?: string;
  dosage?: string;
  frequency?: string;
  course?: string;
  instructions?: string;
  image_key?: string;
  sort_order?: number;
}

export interface InterpretedData {
  doctor?: { name?: string; specialization?: string; registration?: string };
  hospital?: { name?: string; address?: string };
  patient?: { name?: string; age?: string; gender?: string };
  medicines?: InterpretedMedicine[];
}

@Entity('prescriptions')
export class Prescription {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  org_id: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  hospital_id: string | null;

  @Column({ type: 'varchar', length: 36 })
  doctor_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  patient_name: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  patient_phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  patient_uid: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image_key: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  video_key: string | null;

  @Column({ type: 'varchar', length: 50, unique: true })
  access_token: string;

  @Column({
    type: 'enum',
    enum: ['UPLOADED', 'CLAIMED', 'PROCESSING', 'RENDERED', 'SENT'],
    default: 'UPLOADED',
  })
  status: PrescriptionStatus;

  @Column({ type: 'varchar', length: 50, default: 'English' })
  language: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'smallint', nullable: true })
  rx_year: number | null;

  @Column({ type: 'tinyint', nullable: true })
  rx_month: number | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  whatsapp_message_id: string | null;

  @Column({ type: 'json', nullable: true })
  interpreted_data: InterpretedData | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  // ── Relations ──────────────────────────────────────────────────────────
  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'org_id' })
  organization: Organization | null;

  @ManyToOne(() => Hospital, { nullable: true })
  @JoinColumn({ name: 'hospital_id' })
  hospital: Hospital | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'doctor_id' })
  doctor: User;
}
