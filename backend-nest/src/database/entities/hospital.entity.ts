import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, OneToMany, OneToOne, JoinColumn } from 'typeorm';
import { Organization } from './organization.entity';
import { HospitalAddress } from './hospital-address.entity';
import { User } from './user.entity';
import { DoctorProfile } from './doctor-profile.entity';
import { PharmacistProfile } from './pharmacist-profile.entity';
import { OrgUsageCounter } from './org-usage-counter.entity';

export type HospitalStatus = 'ACTIVE' | 'SUSPENDED';

@Entity('hospitals')
export class Hospital {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  org_id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  slug: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, comment: 'Hospital WhatsApp number' })
  waba_phone_number: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: 'WhatsApp Business API token' })
  waba_token: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: 'Meta phone_id for API calls' })
  waba_phone_id: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, default: 'hi-IN', comment: 'hi-IN · ta-IN · bn-IN' })
  tts_language: string | null;

  @Column({ type: 'enum', enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE' })
  status: HospitalStatus;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  // ── Relations ──────────────────────────────────────────────────────────
  @ManyToOne(() => Organization, (org) => org.hospitals)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @OneToOne(() => HospitalAddress, (addr) => addr.hospital, { nullable: true })
  address: HospitalAddress | null;

  @OneToMany(() => User, (user) => user.hospital)
  staff: User[];

  @OneToMany(() => DoctorProfile, (dp) => dp.hospital)
  doctorProfiles: DoctorProfile[];

  @OneToMany(() => PharmacistProfile, (pp) => pp.hospital)
  pharmacistProfiles: PharmacistProfile[];

  @OneToMany(() => OrgUsageCounter, (counter) => counter.hospital)
  usageCounters: OrgUsageCounter[];
}

// Read-model helper (not a DB entity — used for JOIN result typing)
export class HospitalWithAddress extends Hospital {
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  lat: number | null;
  lng: number | null;
}
