import { db } from '../db';
import { users, searchLogs, sovRuns, apiKeys } from '@shared/schema';
import { eq, and, lt, isNotNull } from 'drizzle-orm';

const GRACE_PERIOD_DAYS = 30;

export async function cleanupExpiredAccounts(): Promise<{
  anonymizedCount: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let anonymizedCount = 0;

  const gracePeriodEnd = new Date();
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() - GRACE_PERIOD_DAYS);

  try {
    const expiredUsers = await db.select({
      id: users.id,
      email: users.email,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(
      and(
        eq(users.status, 'withdrawn'),
        isNotNull(users.deletedAt),
        lt(users.deletedAt, gracePeriodEnd)
      )
    );

    console.log(`[AccountCleanup] Found ${expiredUsers.length} expired accounts to anonymize`);

    for (const user of expiredUsers) {
      try {
        await anonymizeUserData(user.id, user.email);
        anonymizedCount++;
        console.log(`[AccountCleanup] Anonymized user ${user.id}`);
      } catch (error) {
        const errorMsg = `Failed to anonymize user ${user.id}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.error(`[AccountCleanup] ${errorMsg}`);
      }
    }

    console.log(`[AccountCleanup] Completed: ${anonymizedCount} accounts anonymized, ${errors.length} errors`);
  } catch (error) {
    const errorMsg = `Cleanup job failed: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(errorMsg);
    console.error(`[AccountCleanup] ${errorMsg}`);
  }

  return { anonymizedCount, errors };
}

async function anonymizeUserData(userId: string, email: string): Promise<void> {
  const anonymizedEmail = `deleted_${userId.slice(0, 8)}@anonymized.local`;
  const anonymizedName = '탈퇴한 회원';

  await db.transaction(async (tx) => {
    await tx.update(users).set({
      email: anonymizedEmail,
      firstName: anonymizedName,
      lastName: null,
      passwordHash: 'ANONYMIZED',
      profileImageUrl: null,
      status: 'deleted',
      updatedAt: new Date(),
    }).where(eq(users.id, userId));

    await tx.delete(apiKeys).where(eq(apiKeys.userId, userId));

    await tx.update(searchLogs).set({
      userId: 'ANONYMIZED',
    }).where(eq(searchLogs.userId, userId));

    await tx.update(sovRuns).set({
      userId: 'ANONYMIZED',
    }).where(eq(sovRuns.userId, userId));
  });
}

export function startCleanupScheduler(): void {
  const runCleanup = async () => {
    console.log('[AccountCleanup] Running scheduled cleanup...');
    await cleanupExpiredAccounts();
  };

  runCleanup();

  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;
  setInterval(runCleanup, CLEANUP_INTERVAL);
  
  console.log('[AccountCleanup] Scheduler started (runs every 24 hours)');
}
