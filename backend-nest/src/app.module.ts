import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { DatabaseModule } from './database/database.module';
import { S3Module } from './common/s3/s3.module';
import { SqsModule } from './common/sqs/sqs.module';
import { LoggerModule } from './common/logger/logger.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { WhatsAppModule } from './common/whatsapp/whatsapp.module';
import { MailModule } from './common/mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { PlatformModule } from './modules/platform/platform.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { HospitalModule } from './modules/hospital/hospital.module';
import { PrescriptionModule } from './modules/prescription/prescription.module';

// TypeORM entities
import { Plan }              from './database/entities/plan.entity';
import { User }              from './database/entities/user.entity';
import { Organization }      from './database/entities/organization.entity';
import { Hospital }          from './database/entities/hospital.entity';
import { HospitalAddress }   from './database/entities/hospital-address.entity';
import { Role }              from './database/entities/role.entity';
import { UserRole }          from './database/entities/user-role.entity';
import { OrgUsageCounter }   from './database/entities/org-usage-counter.entity';
import { DoctorProfile }     from './database/entities/doctor-profile.entity';
import { PharmacistProfile } from './database/entities/pharmacist-profile.entity';
import { RefreshToken }      from './database/entities/refresh-token.entity';
const ALL_ENTITIES = [
  Plan, User, Organization, Hospital, HospitalAddress,
  Role, UserRole, OrgUsageCounter,
  DoctorProfile, PharmacistProfile,
  RefreshToken,
];

@Module({
  providers: [],
  imports: [
    // Config — load .env globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // MongoDB (medicine catalog / autocomplete)
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URI');
        if (!uri) throw new Error('MONGODB_URI environment variable is required');

        const mongoLogger = new Logger('MongoDB');
        mongoLogger.log(`Connecting to ${uri.includes('localhost') ? 'local' : 'Atlas'} instance`);

        const mongoose = await import('mongoose');
        mongoose.connection.on('connected',    () => mongoLogger.log('Connected'));
        mongoose.connection.on('error',   (err) => mongoLogger.error('Connection error', err?.message));
        mongoose.connection.on('disconnected', () => mongoLogger.warn('Disconnected'));

        return { uri };
      },
      inject: [ConfigService],
    }),

    // TypeORM — MySQL (migrations only, never synchronize)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type:     'mysql',
        host:     configService.get<string>('DB_HOST',     'localhost'),
        port:     configService.get<number>('DB_PORT',     3306),
        username: configService.get<string>('DB_USER',     'root'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_NAME',     'prescription_db'),

        entities:            ALL_ENTITIES,
        migrations:          [join(__dirname, 'database/migrations/*.{ts,js}')],
        migrationsRun: true,  // auto-run pending migrations on startup

        synchronize: false,          // NEVER auto-sync — migrations are the source of truth
        logging:     configService.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),

    // mysql2 pool (used directly by services for raw queries)
    DatabaseModule,

    // Global logger
    LoggerModule,

    // Prometheus metrics (/api/metrics)
    MetricsModule,

    // WhatsApp (Meta Cloud API)
    WhatsAppModule,

    // S3 service
    S3Module,

    // SQS producer + consumer
    SqsModule,

    // Mail service
    MailModule,

    // Bounded contexts
    AuthModule,
    PlatformModule,
    OrganizationModule,
    HospitalModule,
    PrescriptionModule,
  ],
})
export class AppModule {}
