import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load .env so CLI commands (typeorm migration:run etc.) pick up DB credentials
dotenv.config({ path: join(__dirname, '../../.env') });

import { Plan }              from './entities/plan.entity';
import { User }              from './entities/user.entity';
import { Organization }      from './entities/organization.entity';
import { Hospital }          from './entities/hospital.entity';
import { HospitalAddress }   from './entities/hospital-address.entity';
import { Role }              from './entities/role.entity';
import { UserRole }          from './entities/user-role.entity';
import { OrgUsageCounter }   from './entities/org-usage-counter.entity';
import { DoctorProfile }     from './entities/doctor-profile.entity';
import { PharmacistProfile } from './entities/pharmacist-profile.entity';
import { RefreshToken }      from './entities/refresh-token.entity';
import { Prescription }      from './entities/prescription.entity';

export const AppDataSource = new DataSource({
  type:     'mysql',
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'prescription_db',

  entities: [
    Plan,
    User,
    Organization,
    Hospital,
    HospitalAddress,
    Role,
    UserRole,
    OrgUsageCounter,
    DoctorProfile,
    PharmacistProfile,
    RefreshToken,
    Prescription,
  ],

  migrations:  [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging:     process.env.NODE_ENV !== 'production',
});
