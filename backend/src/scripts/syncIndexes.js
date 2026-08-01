/**
 * Syncs all model indexes to MongoDB and prints the resulting index list.
 * Usage: node src/scripts/syncIndexes.js
 */
import mongoose from 'mongoose';
import env from '../config/env.js';
import models from '../models/index.js';

const UNIQUE_OR_GEO_HINTS = /unique|2dsphere/i;

const syncAllIndexes = async () => {
  await mongoose.connect(env.mongoUri);
  console.log('[syncIndexes] Connected to MongoDB');

  for (const [name, Model] of Object.entries(models)) {
    const created = await Model.syncIndexes();
    const indexes = await Model.collection.indexes();

    console.log(`\n=== ${name} (${Model.collection.collectionName}) ===`);
    if (created.length > 0) {
      console.log(`  syncIndexes created/dropped names: ${created.join(', ')}`);
    } else {
      console.log('  syncIndexes: already in sync');
    }

    for (const index of indexes) {
      const flags = [];
      if (index.unique) flags.push('unique');
      if (index.sparse) flags.push('sparse');
      if (Object.values(index.key).includes('2dsphere')) flags.push('2dsphere');
      const flagStr = flags.length ? ` [${flags.join(', ')}]` : '';
      const notable = UNIQUE_OR_GEO_HINTS.test(flagStr) ? ' ★' : '';
      console.log(`  - ${JSON.stringify(index.key)}${flagStr}${notable}`);
    }
  }

  await mongoose.disconnect();
  console.log('\n[syncIndexes] Done.');
};

syncAllIndexes().catch((err) => {
  console.error('[syncIndexes] Failed:', err.message);
  process.exit(1);
});
