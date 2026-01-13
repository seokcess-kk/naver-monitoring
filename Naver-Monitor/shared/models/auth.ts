import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  passwordHash: varchar("password_hash").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const verificationTokens = pgTable("verification_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token").notNull().unique(),
  type: varchar("type", { length: 20 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_verification_tokens_user_id").on(table.userId),
  index("idx_verification_tokens_token").on(table.token),
]);

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
});

export const registerSchema = z.object({
  email: z.string().email("유효한 이메일 주소를 입력해주세요"),
  password: z.string().min(8, "비밀번호는 최소 8자 이상이어야 합니다"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("유효한 이메일 주소를 입력해주세요"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type InsertVerificationToken = typeof verificationTokens.$inferInsert;
