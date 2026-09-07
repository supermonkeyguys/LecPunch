import mongoose from 'mongoose';

interface DuplicateActiveSessionGroup {
  _id: string;
  sessionIds: mongoose.Types.ObjectId[];
  count: number;
}

const INDEX_NAME = 'unique_active_attendance_session_per_user';
const shouldApply = process.argv.includes('--apply');

const getMongoUri = () => {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }
  return uri;
};

async function main() {
  const connection = await mongoose.createConnection(getMongoUri(), { autoIndex: false }).asPromise();
  const sessions = connection.collection('attendance_sessions');

  try {
    const duplicates = await sessions
      .aggregate<DuplicateActiveSessionGroup>([
        { $match: { status: 'active' } },
        { $sort: { userId: 1, checkInAt: -1, _id: -1 } },
        {
          $group: {
            _id: '$userId',
            sessionIds: { $push: '$_id' },
            count: { $sum: 1 }
          }
        },
        { $match: { count: { $gt: 1 } } }
      ])
      .toArray();

    const duplicateSessionCount = duplicates.reduce((total, group) => total + group.count - 1, 0);
    console.log(`Active-session duplicate groups: ${duplicates.length}; extra sessions: ${duplicateSessionCount}.`);

    if (!shouldApply) {
      if (duplicates.length > 0) {
        console.log('Dry run only. Review this output, then rerun with --apply to invalidate the older duplicate sessions.');
      }
      console.log(`No database changes made. The ${INDEX_NAME} index was not created.`);
      return;
    }

    const now = new Date();
    for (const group of duplicates) {
      const olderSessionIds = group.sessionIds.slice(1);
      if (olderSessionIds.length === 0) {
        continue;
      }
      await sessions.updateMany(
        { _id: { $in: olderSessionIds }, status: 'active' },
        {
          $set: {
            status: 'invalidated',
            durationSeconds: 0,
            invalidReason: 'heartbeat_timeout',
            checkOutAt: now,
            updatedAt: now
          }
        }
      );
    }

    try {
      await sessions.dropIndex('userId_1');
      console.log('Removed legacy userId_1 index before creating the active-session uniqueness guard.');
    } catch (error: unknown) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? Number(error.code) : undefined;
      if (code !== 27) {
        throw error;
      }
      console.log('Legacy userId_1 index was not present.');
    }

    await sessions.createIndex(
      { userId: 1 },
      {
        unique: true,
        partialFilterExpression: { status: 'active' },
        name: INDEX_NAME
      }
    );
    console.log(`Reconciliation complete. ${INDEX_NAME} is now enforced.`);
  } finally {
    await connection.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
