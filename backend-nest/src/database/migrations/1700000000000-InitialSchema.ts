import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. plans
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id              VARCHAR(36)   NOT NULL PRIMARY KEY,
        name            VARCHAR(100)  NOT NULL,
        slug            VARCHAR(100)  NOT NULL,
        price           DECIMAL(10,2) NOT NULL DEFAULT 0,
        billing_cycle   ENUM('MONTHLY','YEARLY','LIFETIME') NOT NULL DEFAULT 'MONTHLY',
        max_hospitals   INT           NOT NULL DEFAULT 1,
        max_staff_per_hospital INT    NOT NULL DEFAULT 5,
        max_prescriptions_per_month INT NOT NULL DEFAULT 100,
        features        JSON          NULL,
        is_active       TINYINT(1)    NOT NULL DEFAULT 1,
        created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_plans_slug (slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 2. superadmins
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS superadmins (
        id         VARCHAR(36)  NOT NULL PRIMARY KEY,
        name       VARCHAR(255) NOT NULL,
        email      VARCHAR(255) NOT NULL,
        password   VARCHAR(255) NOT NULL,
        created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_superadmins_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 3. organizations — owner_id FK added later (circular with users)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id              VARCHAR(36)   NOT NULL PRIMARY KEY,
        name            VARCHAR(255)  NOT NULL,
        slug            VARCHAR(255)  NOT NULL,
        owner_id        VARCHAR(36)   NULL,
        plan_id         VARCHAR(36)   NULL,
        billing_cycle   ENUM('MONTHLY','YEARLY','LIFETIME') NOT NULL DEFAULT 'MONTHLY',
        address         VARCHAR(500)  NULL,
        phone           VARCHAR(20)   NULL,
        website         VARCHAR(255)  NULL,
        status          ENUM('TRIAL','ACTIVE','SUSPENDED','CANCELLED') NOT NULL DEFAULT 'TRIAL',
        created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_organizations_slug (slug),
        KEY idx_organizations_owner_id (owner_id),
        KEY idx_organizations_plan_id (plan_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 4. hospitals
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hospitals (
        id         VARCHAR(36)  NOT NULL PRIMARY KEY,
        org_id     VARCHAR(36)  NOT NULL,
        name       VARCHAR(255) NOT NULL,
        slug       VARCHAR(255) NOT NULL,
        phone      VARCHAR(20)  NULL,
        email      VARCHAR(255) NULL,
        waba_id    VARCHAR(100) NULL,
        waba_token VARCHAR(255) NULL,
        status     ENUM('ACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_hospitals_org_id (org_id),
        CONSTRAINT fk_hospitals_org FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 5. hospital_addresses
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hospital_addresses (
        id            VARCHAR(36)  NOT NULL PRIMARY KEY,
        hospital_id   VARCHAR(36)  NOT NULL,
        address_line1 VARCHAR(255) NULL,
        address_line2 VARCHAR(255) NULL,
        city          VARCHAR(100) NULL,
        state         VARCHAR(100) NULL,
        pincode       VARCHAR(20)  NULL,
        lat           DECIMAL(10,7) NULL,
        lng           DECIMAL(10,7) NULL,
        created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_hospital_addresses_hospital_id (hospital_id),
        CONSTRAINT fk_hospital_addresses_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 6. roles
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id           VARCHAR(36)  NOT NULL PRIMARY KEY,
        org_id       VARCHAR(36)  NULL,
        hospital_id  VARCHAR(36)  NULL,
        name         VARCHAR(100) NOT NULL,
        display_name VARCHAR(100) NULL,
        base_role    ENUM('DOCTOR','PHARMACIST','VIEWER','ADMIN') NOT NULL DEFAULT 'DOCTOR',
        permissions  JSON         NULL,
        color        VARCHAR(20)  NOT NULL DEFAULT '#1D9E75',
        is_default   TINYINT(1)   NOT NULL DEFAULT 0,
        is_system    TINYINT(1)   NOT NULL DEFAULT 0,
        created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_roles_org_id (org_id),
        KEY idx_roles_hospital_id (hospital_id),
        CONSTRAINT fk_roles_org      FOREIGN KEY (org_id)     REFERENCES organizations (id) ON DELETE CASCADE,
        CONSTRAINT fk_roles_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 7. users — org_id / hospital_id FKs added after organizations/hospitals are created
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id             VARCHAR(36)  NOT NULL PRIMARY KEY,
        name           VARCHAR(255) NOT NULL,
        first_name     VARCHAR(100) NULL,
        last_name      VARCHAR(100) NULL,
        email          VARCHAR(255) NOT NULL,
        password_hash  VARCHAR(255) NULL,
        password       VARCHAR(255) NULL,
        phone          VARCHAR(20)  NULL,
        role           ENUM('ORG_ADMIN','DOCTOR','PHARMACIST') NOT NULL DEFAULT 'DOCTOR',
        status         ENUM('ACTIVE','INACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
        org_id         VARCHAR(36)  NULL,
        hospital_id    VARCHAR(36)  NULL,
        custom_role_id VARCHAR(36)  NULL,
        is_owner       TINYINT(1)   NOT NULL DEFAULT 0,
        is_org_admin   TINYINT(1)   NOT NULL DEFAULT 0,
        created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_users_email (email),
        KEY idx_users_org_id (org_id),
        KEY idx_users_hospital_id (hospital_id),
        KEY idx_users_custom_role_id (custom_role_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 8. Add FK constraints now that both users and organizations exist
    await queryRunner.query(`
      ALTER TABLE users
        ADD CONSTRAINT fk_users_org      FOREIGN KEY (org_id)         REFERENCES organizations (id) ON DELETE SET NULL,
        ADD CONSTRAINT fk_users_hospital FOREIGN KEY (hospital_id)    REFERENCES hospitals (id)     ON DELETE SET NULL,
        ADD CONSTRAINT fk_users_role     FOREIGN KEY (custom_role_id) REFERENCES roles (id)         ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE organizations
        ADD CONSTRAINT fk_organizations_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE SET NULL,
        ADD CONSTRAINT fk_organizations_plan  FOREIGN KEY (plan_id)  REFERENCES plans (id) ON DELETE SET NULL
    `);

    // 9. user_roles
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id         VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id    VARCHAR(36) NOT NULL,
        role_id    VARCHAR(36) NOT NULL,
        is_primary TINYINT(1)  NOT NULL DEFAULT 0,
        created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_roles (user_id, role_id),
        KEY idx_user_roles_role_id (role_id),
        CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 10. doctor_profiles
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS doctor_profiles (
        id                   VARCHAR(36)  NOT NULL PRIMARY KEY,
        user_id              VARCHAR(36)  NOT NULL,
        hospital_id          VARCHAR(36)  NULL,
        role_id              VARCHAR(36)  NULL,
        specialization       VARCHAR(255) NULL,
        license_number       VARCHAR(100) NULL,
        registration_number  VARCHAR(100) NULL,
        signature_key        VARCHAR(255) NULL,
        created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_doctor_profiles_user_id (user_id),
        KEY idx_doctor_profiles_hospital_id (hospital_id),
        CONSTRAINT fk_doctor_profiles_user     FOREIGN KEY (user_id)     REFERENCES users (id)     ON DELETE CASCADE,
        CONSTRAINT fk_doctor_profiles_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals (id) ON DELETE SET NULL,
        CONSTRAINT fk_doctor_profiles_role     FOREIGN KEY (role_id)     REFERENCES roles (id)     ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 11. pharmacist_profiles
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pharmacist_profiles (
        id                    VARCHAR(36)  NOT NULL PRIMARY KEY,
        user_id               VARCHAR(36)  NOT NULL,
        hospital_id           VARCHAR(36)  NULL,
        role_id               VARCHAR(36)  NULL,
        license_number        VARCHAR(100) NULL,
        pharmacy_registration VARCHAR(100) NULL,
        created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_pharmacist_profiles_user_id (user_id),
        KEY idx_pharmacist_profiles_hospital_id (hospital_id),
        CONSTRAINT fk_pharmacist_profiles_user     FOREIGN KEY (user_id)     REFERENCES users (id)     ON DELETE CASCADE,
        CONSTRAINT fk_pharmacist_profiles_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals (id) ON DELETE SET NULL,
        CONSTRAINT fk_pharmacist_profiles_role     FOREIGN KEY (role_id)     REFERENCES roles (id)     ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 12. refresh_tokens
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         VARCHAR(36)  NOT NULL PRIMARY KEY,
        user_id    VARCHAR(36)  NOT NULL,
        token      TEXT         NULL,
        token_hash VARCHAR(64)  NULL,
        expires_at DATETIME     NOT NULL,
        created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_refresh_tokens_user_id (user_id),
        CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 13. org_usage_counters
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS org_usage_counters (
        id          VARCHAR(36) NOT NULL PRIMARY KEY,
        org_id      VARCHAR(36) NOT NULL,
        hospital_id VARCHAR(36) NULL,
        rx_year     SMALLINT    NOT NULL,
        rx_month    TINYINT     NOT NULL,
        rx_count    INT         NOT NULL DEFAULT 0,
        created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_org_usage_counters (org_id, hospital_id, rx_year, rx_month),
        KEY idx_org_usage_counters_org_id (org_id),
        CONSTRAINT fk_org_usage_counters_org      FOREIGN KEY (org_id)      REFERENCES organizations (id) ON DELETE CASCADE,
        CONSTRAINT fk_org_usage_counters_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals (id)     ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 14. prescriptions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS prescriptions (
        id               VARCHAR(36)  NOT NULL PRIMARY KEY,
        doctor_id        VARCHAR(36)  NULL,
        doctor_name      VARCHAR(255) NULL,
        hospital_id      VARCHAR(36)  NULL,
        org_id           VARCHAR(36)  NULL,
        patient_name     VARCHAR(255) NOT NULL,
        patient_phone    VARCHAR(20)  NOT NULL,
        language         VARCHAR(50)  NOT NULL DEFAULT 'English',
        image_url        VARCHAR(500) NULL,
        video_url        VARCHAR(500) NULL,
        access_token     VARCHAR(32)  NULL,
        notes            TEXT         NULL,
        interpreted_data JSON         NULL,
        status           ENUM('UPLOADED','RENDERED','SENT') NOT NULL DEFAULT 'UPLOADED',
        rx_year          SMALLINT     NULL,
        rx_month         TINYINT      NULL,
        created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_prescriptions_doctor_id  (doctor_id),
        KEY idx_prescriptions_org_id     (org_id),
        KEY idx_prescriptions_hospital_id (hospital_id),
        CONSTRAINT fk_prescriptions_doctor   FOREIGN KEY (doctor_id)   REFERENCES users (id)         ON DELETE SET NULL,
        CONSTRAINT fk_prescriptions_org      FOREIGN KEY (org_id)      REFERENCES organizations (id) ON DELETE SET NULL,
        CONSTRAINT fk_prescriptions_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals (id)     ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse FK-safe order
    await queryRunner.query(`DROP TABLE IF EXISTS prescriptions`);
    await queryRunner.query(`DROP TABLE IF EXISTS org_usage_counters`);
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS pharmacist_profiles`);
    await queryRunner.query(`DROP TABLE IF EXISTS doctor_profiles`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_roles`);

    // Remove circular FK constraints before dropping users/organizations
    await queryRunner.query(`ALTER TABLE users        DROP FOREIGN KEY fk_users_org`);
    await queryRunner.query(`ALTER TABLE users        DROP FOREIGN KEY fk_users_hospital`);
    await queryRunner.query(`ALTER TABLE users        DROP FOREIGN KEY fk_users_role`);
    await queryRunner.query(`ALTER TABLE organizations DROP FOREIGN KEY fk_organizations_owner`);
    await queryRunner.query(`ALTER TABLE organizations DROP FOREIGN KEY fk_organizations_plan`);

    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TABLE IF EXISTS roles`);
    await queryRunner.query(`DROP TABLE IF EXISTS hospital_addresses`);
    await queryRunner.query(`DROP TABLE IF EXISTS hospitals`);
    await queryRunner.query(`DROP TABLE IF EXISTS organizations`);
    await queryRunner.query(`DROP TABLE IF EXISTS superadmins`);
    await queryRunner.query(`DROP TABLE IF EXISTS plans`);
  }
}
