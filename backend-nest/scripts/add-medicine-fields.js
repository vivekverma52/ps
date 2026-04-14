/**
 * One-time MongoDB migration
 * Adds manufacturer_name, marketer_name, salt_composition, tablet_color, appearance
 * (as null) to every existing document in medicine_prescription that is missing them.
 *
 * Usage:
 *   node scripts/add-medicine-fields.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const NEW_FIELDS = [
  'manufacturer_name',
  'marketer_name',
  'salt_composition',
  'tablet_color',
  'appearance',
];

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI is not set in .env');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const col = client.db().collection('medicine_prescription');
    const total = await col.countDocuments();
    console.log(`Total documents: ${total}`);

    for (const field of NEW_FIELDS) {
      const missing = await col.countDocuments({ [field]: { $exists: false } });
      if (missing === 0) {
        console.log(`  ${field}: already present in all documents — skipping`);
        continue;
      }

      const result = await col.updateMany(
        { [field]: { $exists: false } },
        { $set: { [field]: null } },
      );
      console.log(`  ${field}: set to null in ${result.modifiedCount} document(s)`);
    }

    console.log('\nDone.');
  } finally {
    await client.close();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
