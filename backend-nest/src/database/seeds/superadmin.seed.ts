import { PoolConnection } from 'mysql2/promise';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@nestjs/common';

export async function seedSuperadmin(conn: PoolConnection, logger: Logger): Promise<void> {
  const [existing]: any = await conn.execute('SELECT id FROM superadmins LIMIT 1');
  if (existing.length > 0) return;

  const email    = process.env.SUPERADMIN_EMAIL    || 'admin@exato.in';
  const password = process.env.SUPERADMIN_PASSWORD || 'Exato@2024';
  const hashed   = await bcrypt.hash(password, 10);

  await conn.execute(
    'INSERT INTO superadmins (id, name, email, password) VALUES (?, ?, ?, ?)',
    [uuidv4(), 'Exato Admin', email, hashed],
  );
  logger.log(`Superadmin seeded: ${email}`);
}
