// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mysql = require('mysql2/promise');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bcrypt = require('bcryptjs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { v4: uuidv4 } = require('uuid');

async function run() {
  const pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'prescription_db',
  });

  const conn = await pool.getConnection();
  try {
    const [existing]: any = await conn.execute('SELECT id FROM superadmins LIMIT 1');
    if ((existing as any[]).length > 0) {
      process.stdout.write('Superadmin already exists — skipping.\n');
      return;
    }

    const email    = process.env.SUPERADMIN_EMAIL;
    const password = process.env.SUPERADMIN_PASSWORD;

    if (!email || !password) {
      throw new Error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD env vars are required to seed');
    }

    const hashed   = await bcrypt.hash(password, 10);

    await conn.execute(
      'INSERT INTO superadmins (id, name, email, password) VALUES (?, ?, ?, ?)',
      [uuidv4(), 'Exato Admin', email, hashed],
    );
    process.stdout.write(`Superadmin seeded: ${email}\n`);
  } finally {
    conn.release();
    await pool.end();
  }
}

run().catch(err => { process.stderr.write(`Seed failed: ${err?.message}\n${err?.stack}\n`); process.exit(1); });
