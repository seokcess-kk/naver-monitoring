import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from './db';
import { users, verificationTokens, type User, type VerificationToken } from '@shared/schema';
import { eq, and, gt } from 'drizzle-orm';
import { sendVerificationEmail, sendPasswordResetEmail } from './email-service';

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

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  return user;
}

export async function findUserById(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function registerUser(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string
): Promise<{ user: User; verificationToken: string }> {
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw new Error('이미 등록된 이메일입니다');
  }

  const passwordHash = await hashPassword(password);
  
  const [user] = await db.insert(users).values({
    email: email.toLowerCase(),
    passwordHash,
    firstName,
    lastName,
    emailVerified: false,
  }).returning();

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.insert(verificationTokens).values({
    userId: user.id,
    token,
    type: 'email_verification',
    expiresAt,
  });

  await sendVerificationEmail(user.email, token, firstName);

  return { user, verificationToken: token };
}

export async function loginUser(email: string, password: string): Promise<User> {
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

  return user;
}

export async function verifyEmailToken(token: string): Promise<User> {
  const [tokenRecord] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.token, token),
        eq(verificationTokens.type, 'email_verification'),
        gt(verificationTokens.expiresAt, new Date())
      )
    );

  if (!tokenRecord) {
    throw new Error('유효하지 않거나 만료된 인증 링크입니다');
  }

  const [user] = await db
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(users.id, tokenRecord.userId))
    .returning();

  await db.delete(verificationTokens).where(eq(verificationTokens.id, tokenRecord.id));

  return user;
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

  if (!tokenRecord) {
    throw new Error('유효하지 않거나 만료된 재설정 링크입니다');
  }

  const passwordHash = await hashPassword(newPassword);

  const [user] = await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, tokenRecord.userId))
    .returning();

  await db.delete(verificationTokens).where(eq(verificationTokens.id, tokenRecord.id));

  return user;
}

export async function resendVerificationEmail(email: string): Promise<void> {
  const user = await findUserByEmail(email);
  if (!user) {
    return;
  }

  if (user.emailVerified) {
    throw new Error('이미 인증된 이메일입니다');
  }

  await db.delete(verificationTokens).where(
    and(
      eq(verificationTokens.userId, user.id),
      eq(verificationTokens.type, 'email_verification')
    )
  );

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.insert(verificationTokens).values({
    userId: user.id,
    token,
    type: 'email_verification',
    expiresAt,
  });

  await sendVerificationEmail(user.email, token, user.firstName || undefined);
}
