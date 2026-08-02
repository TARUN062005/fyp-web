/**
 * Verifies updateProfileForUserId (PATCH /profile service).
 *
 * Usage: node src/scripts/verifyProfilePatch.js
 */
import mongoose from 'mongoose';
import env from '../config/env.js';
import User from '../models/User.js';
import { updateProfileForUserId } from '../services/authService.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const run = async () => {
  await mongoose.connect(env.mongoUri);

  const marker = `patch-profile-test-${Date.now()}`;
  await User.deleteMany({
    $or: [
      { googleAccountId: { $regex: /^patch-profile-test-/ } },
      { emergencyId: 'EDTN-PCH01' },
    ],
  });

  const fresh = await User.create({
    googleAccountId: marker,
    emergencyId: 'EDTN-PCH01',
    displayName: 'Before Patch',
    publicKey: 'pk-patch-test',
    publicKeyFingerprint: 'fp-patch-test',
  });

  try {
    const updated = await updateProfileForUserId(String(fresh._id), {
      displayName: 'Tarun',
      phoneNumber: '+911111111111',
      emergencyContact: '+912222222222',
    });

    assert(updated.displayName === 'Tarun', 'displayName not updated');
    assert(updated.phoneNumber === '+911111111111', 'phoneNumber not updated');
    assert(
      updated.emergencyContact === '+912222222222',
      'emergencyContact flat phone not returned'
    );
    assert(updated.emergencyId === 'EDTN-PCH01', 'emergencyId must be stable');
    assert(typeof updated.updatedAt === 'string', 'updatedAt ISO string required');

    const reloaded = await User.findById(fresh._id);
    assert(reloaded.displayName === 'Tarun', 'Mongo displayName mismatch');
    assert(reloaded.phoneNumber === '+911111111111', 'Mongo phoneNumber mismatch');
    assert(
      reloaded.emergencyContact?.phoneNumber === '+912222222222',
      'Mongo emergencyContact.phoneNumber mismatch'
    );

    const cleared = await updateProfileForUserId(String(fresh._id), {
      displayName: 'Tarun',
      phoneNumber: null,
      emergencyContact: null,
    });
    assert(cleared.phoneNumber === null, 'phoneNumber clear failed');
    assert(cleared.emergencyContact === null, 'emergencyContact clear failed');

    console.log('[verify] PASS — PATCH /profile update + clear');
  } finally {
    await User.deleteMany({
      $or: [{ googleAccountId: marker }, { emergencyId: 'EDTN-PCH01' }],
    });
    await mongoose.disconnect();
  }
};

run().catch(async (err) => {
  console.error('[verify] FAIL:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
