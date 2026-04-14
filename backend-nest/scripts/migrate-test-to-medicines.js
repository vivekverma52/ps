/**
 * One-time migration: copies all documents from the `test` database
 * into the `medicines` database, then drops the `test` collections.
 *
 * Collections migrated:
 *   test.medicine_prescription       → medicines.medicine_prescription
 *   test.prescription_video_cache    → medicines.prescription_video_cache
 *
 * Usage:
 *   node scripts/migrate-test-to-medicines.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const COLLECTIONS = ['medicine_prescription', 'prescription_video_cache'];

async function migrate(client, colName) {
  const src = client.db('test').collection(colName);
  const dst = client.db('medicines').collection(colName);

  const docs = await src.find({}).toArray();
  if (docs.length === 0) {
    console.log(`  ${colName}: nothing in test — skipping`);
    return;
  }

  // Avoid duplicate key errors — skip _ids that already exist in destination
  const existingIds = new Set(
    (await dst.find({}, { projection: { _id: 1 } }).toArray()).map(d => d._id.toString()),
  );
  const toInsert = docs.filter(d => !existingIds.has(d._id.toString()));

  if (toInsert.length > 0) {
    await dst.insertMany(toInsert, { ordered: false });
    console.log(`  ${colName}: copied ${toInsert.length} document(s) → medicines`);
  } else {
    console.log(`  ${colName}: all ${docs.length} document(s) already exist in medicines — skipping insert`);
  }

  await src.drop();
  console.log(`  ${colName}: test collection dropped`);
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Connected\n');

    for (const col of COLLECTIONS) {
      console.log(`Migrating ${col}...`);
      await migrate(client, col);
    }

    console.log('\nDone. The test database is now empty and can be deleted from Atlas.');
  } finally {
    await client.close();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
