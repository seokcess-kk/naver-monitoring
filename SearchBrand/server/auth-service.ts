import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from './db';
import { users, verificationTokens, withdrawnEmails, type User, type VerificationToken } from '@shared/schema';
import { eq, and, gt, or, lt } from 'drizzle-orm';
import { sendRegistrationEmail, sendPasswordResetEmail } from './email-service';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

async function createAndSendRegistrationToken(email: string): Promise<void> {
  await db.delete(verificationTokens).where(
    and(
      eq(verificationTokens.email, email),
      eq(verificationTokens.type, 'registration')
    )
  );

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.insert(verificationTokens).values({
    email,
    token,
    type: 'registration',
    expiresAt,
  });

  try {
    await sendRegistrationEmail(email, token);
  } catch (emailError: any) {
    await db.delete(verificationTokens).where(eq(verificationTokens.token, token));
    
    if (emailError.code === 403) {
      throw new Error('이메일 발송 서비스 설정이 필요합니다. 관리자에게 문의해주세요.');
    }
    throw new Error('이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
  }
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  return user;
}

export async function findUserById(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function startRegistration(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  
  const existingUser = await findUserByEmail(normalizedEmail);
  if (existingUser) {
    throw new Error('이미 등록된 이메일입니다');
  }

  const blocked = await isEmailBlocked(normalizedEmail);
  if (blocked.blocked) {
    const remainingDays = blocked.canReregisterAt 
      ? Math.ceil((blocked.canReregisterAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 30;
    throw new Error(`탈퇴 후 ${remainingDays}일간 동일 이메일로 재가입이 제한됩니다`);
  }

  await createAndSendRegistrationToken(normalizedEmail);
}

export async function verifyRegistrationToken(token: string): Promise<{ email: string; valid: boolean }> {
  const [tokenRecord] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.token, token),
        eq(verificationTokens.type, 'registration'),
        gt(verificationTokens.expiresAt, new Date())
      )
    );

  if (!tokenRecord || !tokenRecord.email) {
    throw new Error('유효하지 않거나 만료된 인증 링크입니다');
  }

  return { email: tokenRecord.email, valid: true };
}

export async function completeRegistration(
  token: string,
  password: string,
  firstName?: string,
  lastName?: string
): Promise<User> {
  if (!token || token.length === 0) {
    throw new Error('인증 토큰이 필요합니다');
  }

  if (!password || password.length < 8) {
    throw new Error('비밀번호는 최소 8자 이상이어야 합니다');
  }

  const [tokenRecord] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.token, token),
        eq(verificationTokens.type, 'registration'),
        gt(verificationTokens.expiresAt, new Date())
      )
    );

  if (!tokenRecord || !tokenRecord.email) {
    throw new Error('유효하지 않거나 만료된 인증 링크입니다');
  }

  const existingUser = await findUserByEmail(tokenRecord.email);
  if (existingUser) {
    throw new Error('이미 등록된 이메일입니다');
  }

  const passwordHash = await hashPassword(password);

  const user = await db.transaction(async (tx) => {
    const [newUser] = await tx.insert(users).values({
      email: tokenRecord.email!,
      passwordHash,
      firstName,
      lastName,
      emailVerified: true,
    }).returning();

    await tx.delete(verificationTokens).where(eq(verificationTokens.id, tokenRecord.id));

    return newUser;
  });

  return user;
}

export interface LoginResult {
  user: User;
  needsRestore?: boolean;
  deletedAt?: Date;
  gracePeriodEnd?: Date;
}

export async function loginUser(email: string, password: string): Promise<LoginResult> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error('이메일 또는 비밀번호가 올바르지 않습니다');
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new Error('이메일 또는 비밀번호가 올바르지 않습니다');
  }

  if (!user.emailVerified) {
    throw new Error('이메일 인증이 필요합니다. 이메일을 확인해주세요');
  }

  if (user.status === 'withdrawn') {
    if (!user.deletedAt) {
      throw new Error('계정 상태를 확인할 수 없습니다. 고객센터에 문의해주세요');
    }

    const gracePeriodEnd = new Date(user.deletedAt);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30);

    if (new Date() > gracePeriodEnd) {
      throw new Error('탈퇴 처리가 완료된 계정입니다. 새로 가입해주세요');
    }

    return {
      user,
      needsRestore: true,
      deletedAt: user.deletedAt,
      gracePeriodEnd,
    };
  }

  return { user };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await findUserByEmail(email);
  if (!user) {
    return;
  }

  await db.delete(verificationTokens).where(
    and(
      eq(verificationTokens.userId, user.id),
      eq(verificationTokens.type, 'password_reset')
    )
  );

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await db.insert(verificationTokens).values({
    userId: user.id,
    token,
    type: 'password_reset',
    expiresAt,
  });

  await sendPasswordResetEmail(user.email, token, user.firstName || undefined);
}

export async function resetPassword(token: string, newPassword: string): Promise<User> {
  const [tokenRecord] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.token, token),
        eq(verificationTokens.type, 'password_reset'),
        gt(verificationTokens.expiresAt, new Date())
      )
    );

  if (!tokenRecord || !tokenRecord.userId) {
    throw new Error('유효하지 않거나 만료된 재설정 링크입니다');
  }

  const passwordHash = await hashPassword(newPassword);

  const user = await db.transaction(async (tx) => {
    const [updatedUser] = await tx
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, tokenRecord.userId!))
      .returning();

    await tx.delete(verificationTokens).where(eq(verificationTokens.id, tokenRecord.id));

    return updatedUser;
  });

  return user;
}

export async function resendRegistrationEmail(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  
  const existingUser = await findUserByEmail(normalizedEmail);
  if (existingUser) {
    throw new Error('이미 등록된 이메일입니다');
  }

  await createAndSendRegistrationToken(normalizedEmail);
}

function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
}

export async function withdrawUser(userId: string, password: string): Promise<void> {
  const user = await findUserById(userId);
  if (!user) {
    throw new Error('사용자를 찾을 수 없습니다');
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new Error('비밀번호가 일치하지 않습니다');
  }

  if (user.status === 'withdrawn') {
    throw new Error('이미 탈퇴된 계정입니다');
  }

  const emailHash = hashEmail(user.email);
  const canReregisterAt = new Date();
  canReregisterAt.setDate(canReregisterAt.getDate() + 30);

  await db.transaction(async (tx) => {
    await tx.update(users).set({
      status: 'withdrawn',
      deletedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(users.id, userId));

    await tx.insert(withdrawnEmails).values({
      emailHash,
      canReregisterAt,
    }).onConflictDoUpdate({
      target: withdrawnEmails.emailHash,
      set: {
        withdrawnAt: new Date(),
        canReregisterAt,
      },
    });
  });
}

export async function restoreUser(userId: string): Promise<User> {
  const user = await findUserById(userId);
  if (!user) {
    throw new Error('사용자를 찾을 수 없습니다');
  }

  if (user.status !== 'withdrawn') {
    throw new Error('탈퇴 상태가 아닙니다');
  }

  const deletedAt = user.deletedAt;
  if (!deletedAt) {
    throw new Error('탈퇴 일시를 확인할 수 없습니다');
  }

  const gracePeriodEnd = new Date(deletedAt);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30);

  if (new Date() > gracePeriodEnd) {
    throw new Error('복구 가능 기간(30일)이 지났습니다');
  }

  const emailHash = hashEmail(user.email);

  await db.transaction(async (tx) => {
    await tx.update(users).set({
      status: 'active',
      deletedAt: null,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));

    await tx.delete(withdrawnEmails).where(eq(withdrawnEmails.emailHash, emailHash));
  });

  const updatedUser = await findUserById(userId);
  if (!updatedUser) {
    throw new Error('사용자 복구 중 오류가 발생했습니다');
  }

  return updatedUser;
}

export async function isEmailBlocked(email: string): Promise<{ blocked: boolean; canReregisterAt?: Date }> {
  const emailHash = hashEmail(email.toLowerCase());
  
  const [record] = await db.select()
    .from(withdrawnEmails)
    .where(eq(withdrawnEmails.emailHash, emailHash))
    .limit(1);

  if (!record) {
    return { blocked: false };
  }

  if (record.canReregisterAt && new Date() >= record.canReregisterAt) {
    await db.delete(withdrawnEmails).where(eq(withdrawnEmails.id, record.id));
    return { blocked: false };
  }

  return { blocked: true, canReregisterAt: record.canReregisterAt ?? undefined };
}
