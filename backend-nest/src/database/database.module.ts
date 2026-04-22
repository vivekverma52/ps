import { Global, Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mysql from 'mysql2/promise';

export const MYSQL_POOL = 'MYSQL_POOL';

/**
 * Provides a raw mysql2 connection pool (MYSQL_POOL token).
 * Services use this for all raw SQL queries.
 *
 * Schema management is handled exclusively by TypeORM migrations
 * (AppModule → TypeOrmModule.forRootAsync runs pending migrations automatically on startup).
 */
@Global()
@Module({
  providers: [
    {
      provide: MYSQL_POOL,
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('DatabaseModule');

        const host     = configService.get<string>('DB_HOST',     'localhost');
        const port     = configService.get<number>('DB_PORT',     3306);
        const user     = configService.get<string>('DB_USER',     'root');
        const database = configService.get<string>('DB_NAME',     'prescription_db');

        logger.log(`Connecting to MySQL at ${host}:${port}/${database} (user: ${user})`);

        const pool = mysql.createPool({
          host,
          port,
          user,
          password:           configService.get<string>('DB_PASSWORD', ''),
          database,
          waitForConnections: true,
          connectionLimit:    50,   // raised from 10 — supports ~50 concurrent DB operations
          queueLimit:         100,  // bounded queue — rejects beyond 100 waiting requests instead of growing forever
          connectTimeout:     10_000,
        });

        // Verify connectivity — retry up to 3 times (handles slow Docker/RDS startup)
        const MAX_ATTEMPTS = 3;
        let lastErr: Error | undefined;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          try {
            const conn = await pool.getConnection();
            await conn.execute('SELECT 1');
            conn.release();
            logger.log(`MySQL connection verified (attempt ${attempt})`);
            lastErr = undefined;
            break;
          } catch (err: unknown) {
            lastErr = err as Error;
            const code   = (err as { code?: string })?.code    ?? 'UNKNOWN';
            const detail = (err as Error)?.message ?? String(err);
            logger.warn(`MySQL attempt ${attempt}/${MAX_ATTEMPTS} failed [${code}]: ${detail}`);
            if (attempt < MAX_ATTEMPTS) {
              await new Promise(r => setTimeout(r, 2000 * attempt));
            }
          }
        }

        if (lastErr) {
          const code   = (lastErr as { code?: string })?.code    ?? 'UNKNOWN';
          const detail = lastErr.message;
          logger.error(
            `MySQL unreachable after ${MAX_ATTEMPTS} attempts [${code}]: ${detail}.\n` +
            `  → Local dev: ensure MySQL is running on ${host}:${port}\n` +
            `  → RDS: whitelist your IP in the security group (port 3306)`,
          );
          throw new Error(`Cannot connect to MySQL (${code}): ${detail}`);
        }

        return pool;
      },
      inject: [ConfigService],
    },
  ],
  exports: [MYSQL_POOL],
})
export class DatabaseModule {}
