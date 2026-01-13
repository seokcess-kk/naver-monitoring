import type { Express, Request, Response, NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import {
  registerUser,
  loginUser,
  verifyEmailToken,
  requestPasswordReset,
  resetPassword,
  resendVerificationEmail,
  findUserById,
} from "./auth-service";
import { registerSchema, loginSchema } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "너무 많은 요청입니다. 잠시 후 다시 시도해주세요." },
  keyGenerator: (req) => getClientIp(req),
  validate: { xForwardedForHeader: false },
});

const resendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "인증 이메일 재발송 요청이 너무 많습니다. 1분 후 다시 시도해주세요." },
  keyGenerator: (req) => getClientIp(req),
  validate: { xForwardedForHeader: false },
});

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.session?.userId) {
    return next();
  }
  return res.status(401).json({ message: "로그인이 필요합니다" });
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/register", authLimiter, async (req, res) => {
    try {
      const parseResult = registerSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          message: "입력 값이 올바르지 않습니다",
          errors: parseResult.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }

      const { email, password, firstName, lastName } = parseResult.data;

      const { user } = await registerUser(email, password, firstName, lastName);

      res.status(201).json({
        message: "회원가입이 완료되었습니다. 이메일을 확인하여 인증을 완료해주세요.",
        email: user.email,
      });
    } catch (error: any) {
      console.error("[Auth] Register error:", error);
      if (error.message === "이미 등록된 이메일입니다") {
        return res.status(409).json({ message: error.message });
      }
      res.status(500).json({ message: "회원가입 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          message: "입력 값이 올바르지 않습니다",
          errors: parseResult.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }

      const { email, password } = parseResult.data;

      const user = await loginUser(email, password);

      req.session.userId = user.id;

      res.json({
        message: "로그인되었습니다",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          emailVerified: user.emailVerified,
        },
      });
    } catch (error: any) {
      console.error("[Auth] Login error:", error);
      const errorMessage = error.message || "로그인 중 오류가 발생했습니다";
      if (
        errorMessage.includes("이메일") ||
        errorMessage.includes("비밀번호") ||
        errorMessage.includes("인증")
      ) {
        return res.status(401).json({ message: errorMessage });
      }
      res.status(500).json({ message: "로그인 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("[Auth] Logout error:", err);
        return res.status(500).json({ message: "로그아웃 중 오류가 발생했습니다" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "로그아웃되었습니다" });
    });
  });

  app.get("/api/auth/user", async (req, res) => {
    if (!req.session?.userId) {
      return res.json(null);
    }

    try {
      const user = await findUserById(req.session.userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.json(null);
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified,
        profileImageUrl: user.profileImageUrl,
      });
    } catch (error) {
      console.error("[Auth] Get user error:", error);
      res.status(500).json({ message: "사용자 정보 조회 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/auth/verify-email", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.redirect("/?error=invalid_token");
      }

      await verifyEmailToken(token);

      res.redirect("/auth?verified=true");
    } catch (error: any) {
      console.error("[Auth] Email verification error:", error);
      res.redirect(`/auth?error=${encodeURIComponent(error.message || "verification_failed")}`);
    }
  });

  app.post("/api/auth/resend-verification", resendLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "이메일 주소를 입력해주세요" });
      }

      await resendVerificationEmail(email);

      res.json({ message: "인증 이메일이 발송되었습니다" });
    } catch (error: any) {
      console.error("[Auth] Resend verification error:", error);
      if (error.message === "이미 인증된 이메일입니다") {
        return res.status(400).json({ message: error.message });
      }
      res.json({ message: "이메일이 등록되어 있다면 인증 메일이 발송됩니다" });
    }
  });

  app.post("/api/auth/forgot-password", authLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "이메일 주소를 입력해주세요" });
      }

      await requestPasswordReset(email);

      res.json({ message: "비밀번호 재설정 메일이 발송되었습니다" });
    } catch (error) {
      console.error("[Auth] Forgot password error:", error);
      res.json({ message: "이메일이 등록되어 있다면 비밀번호 재설정 메일이 발송됩니다" });
    }
  });

  app.post("/api/auth/reset-password", authLimiter, async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ message: "토큰과 새 비밀번호가 필요합니다" });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: "비밀번호는 최소 8자 이상이어야 합니다" });
      }

      await resetPassword(token, password);

      res.json({ message: "비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해주세요." });
    } catch (error: any) {
      console.error("[Auth] Reset password error:", error);
      if (error.message.includes("유효하지 않") || error.message.includes("만료된")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "비밀번호 재설정 중 오류가 발생했습니다" });
    }
  });
}
