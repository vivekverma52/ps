/**
 * One-time MongoDB migration
 * Removes the `dosage_description` field from every document
 * in the `medicine_prescription` collection.
 *
 * Usage:
 *   node scripts/remove-dosage-description.js
 *
 * Requires MONGODB_URI in backend-nest/.env
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

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

    const db = client.db(); // uses the DB name from the URI
    const col = db.collection('medicine_prescription');

    // Count how many documents still have the field
    const before = await col.countDocuments({ dosage_description: { $exists: true } });
    console.log(`Documents with dosage_description: ${before}`);

    if (before === 0) {
      console.log('Nothing to do — field already removed from all documents.');
      return;
    }

    const result = await col.updateMany(
      { dosage_description: { $exists: true } },
      { $unset: { dosage_description: '' } },
    );

    console.log(`Done. Modified ${result.modifiedCount} document(s).`);

    const after = await col.countDocuments({ dosage_description: { $exists: true } });
    console.log(`Documents still with dosage_description: ${after}`);
  } finally {
    await client.close();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
