import { Entity, PrimaryColumn, Column, CreateDateColumn, OneToOne, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Hospital } from './hospital.entity';
import { Role } from './role.entity';

@Entity('pharmacist_profiles')
export class PharmacistProfile {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36, unique: true })
  user_id: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  hospital_id: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  role_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  license_number: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  pharmacy_registration: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  // ── Relations ──────────────────────────────────────────────────────────
  @OneToOne(() => User, (user) => user.pharmacistProfile)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Hospital, (hospital) => hospital.pharmacistProfiles, { nullable: true })
  @JoinColumn({ name: 'hospital_id' })
  hospital: Hospital | null;

  @ManyToOne(() => Role, { nullable: true })
  @JoinColumn({ name: 'role_id' })
  role: Role | null;
}
