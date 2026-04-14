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
          connectionLimit:    10,
          queueLimit:         0,
          connectTimeout:     10_000,
        });

        // Verify connectivity immediately — fail fast if DB is unreachable
        try {
          const conn = await pool.getConnection();
          await conn.execute('SELECT 1');
          conn.release();
          logger.log('MySQL connection verified');
        } catch (err: any) {
          const code   = err?.code    ?? 'UNKNOWN';
          const detail = err?.message ?? String(err);
          logger.error(
            `MySQL connection failed [${code}]: ${detail}. ` +
            `Check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME in .env`,
            err?.stack,
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
