import type { Express, Request, Response, NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import {
  startRegistration,
  verifyRegistrationToken,
  completeRegistration,
  loginUser,
  requestPasswordReset,
  resetPassword,
  resendRegistrationEmail,
  findUserById,
  withdrawUser,
  restoreUser,
} from "./auth-service";
import { startRegistrationSchema, completeRegistrationSchema, loginSchema, withdrawSchema } from "@shared/schema";
import { getClientIp, validateRequest } from "./utils/request-helpers";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
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
  app.post("/api/auth/start-registration", authLimiter, async (req, res) => {
    try {
      const validation = validateRequest(startRegistrationSchema, req.body);
      if (!validation.success) {
        return res.status(400).json(validation.error);
      }

      const { email } = validation.data;

      await startRegistration(email);

      res.status(200).json({
        message: "인증 이메일이 발송되었습니다. 이메일을 확인해주세요.",
        email,
      });
    } catch (error: any) {
      console.error("[Auth] Start registration error:", error);
      if (error.message === "이미 등록된 이메일입니다") {
        return res.status(409).json({ message: error.message });
      }
      res.status(500).json({ message: "회원가입 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/auth/verify-registration", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.status(400).json({ message: "토큰이 필요합니다", valid: false });
      }

      const result = await verifyRegistrationToken(token);

      res.json({
        valid: true,
        email: result.email,
      });
    } catch (error: any) {
      console.error("[Auth] Verify registration token error:", error);
      res.status(400).json({
        message: error.message || "유효하지 않은 토큰입니다",
        valid: false,
      });
    }
  });

  app.post("/api/auth/complete-registration", authLimiter, async (req, res) => {
    try {
      const validation = validateRequest(completeRegistrationSchema, req.body);
      if (!validation.success) {
        return res.status(400).json(validation.error);
      }

      const { token, password, firstName, lastName } = validation.data;

      const user = await completeRegistration(token, password, firstName, lastName);

      req.session.userId = user.id;

      res.status(201).json({
        message: "회원가입이 완료되었습니다.",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          emailVerified: user.emailVerified,
        },
      });
    } catch (error: any) {
      console.error("[Auth] Complete registration error:", error);
      if (error.message === "이미 등록된 이메일입니다") {
        return res.status(409).json({ message: error.message });
      }
      if (error.message.includes("유효하지 않") || error.message.includes("만료된")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "회원가입 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/auth/resend-registration", resendLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "이메일 주소를 입력해주세요" });
      }

      await resendRegistrationEmail(email);

      res.json({ message: "인증 이메일이 재발송되었습니다" });
    } catch (error: any) {
      console.error("[Auth] Resend registration error:", error);
      if (error.message === "이미 등록된 이메일입니다") {
        return res.status(409).json({ message: error.message });
      }
      res.json({ message: "인증 이메일이 발송되었습니다" });
    }
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const validation = validateRequest(loginSchema, req.body);
      if (!validation.success) {
        return res.status(400).json(validation.error);
      }

      const { email, password } = validation.data;

      const result = await loginUser(email, password);

      req.session.userId = result.user.id;

      if (result.needsRestore) {
        return res.json({
          message: "탈퇴 처리 중인 계정입니다. 복구하시겠습니까?",
          needsRestore: true,
          deletedAt: result.deletedAt,
          gracePeriodEnd: result.gracePeriodEnd,
          user: {
            id: result.user.id,
            email: result.user.email,
            firstName: result.user.firstName,
            lastName: result.user.lastName,
            emailVerified: result.user.emailVerified,
            status: result.user.status,
          },
        });
      }

      res.json({
        message: "로그인되었습니다",
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          emailVerified: result.user.emailVerified,
          status: result.user.status,
        },
      });
    } catch (error: any) {
      console.error("[Auth] Login error:", error);
      const errorMessage = error.message || "로그인 중 오류가 발생했습니다";
      if (
        errorMessage.includes("이메일") ||
        errorMessage.includes("비밀번호") ||
        errorMessage.includes("인증") ||
        errorMessage.includes("탈퇴")
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
        role: user.role,
        status: user.status,
      });
    } catch (error) {
      console.error("[Auth] Get user error:", error);
      res.status(500).json({ message: "사용자 정보 조회 중 오류가 발생했습니다" });
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

  app.post("/api/auth/withdraw", async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    try {
      const result = withdrawSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0]?.message || "잘못된 요청입니다" });
      }

      const { password } = result.data;
      const userId = req.session.userId;

      await withdrawUser(userId, password);

      req.session.destroy((err) => {
        if (err) {
          console.error("[Auth] Session destroy error after withdraw:", err);
        }
        res.clearCookie("connect.sid");
        res.clearCookie("naver_monitor_sid");
        res.json({ 
          message: "탈퇴가 완료되었습니다. 30일 이내에 로그인하시면 계정을 복구할 수 있습니다.",
          gracePeriodDays: 30
        });
      });
    } catch (error: any) {
      console.error("[Auth] Withdraw error:", error);
      if (error.message.includes("비밀번호") || error.message.includes("일치")) {
        return res.status(401).json({ message: error.message });
      }
      if (error.message.includes("이미 탈퇴")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "회원 탈퇴 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/auth/restore", async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    try {
      const userId = req.session.userId;
      const user = await restoreUser(userId);

      res.json({ 
        message: "계정이 복구되었습니다.",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          status: user.status,
        }
      });
    } catch (error: any) {
      console.error("[Auth] Restore error:", error);
      if (error.message.includes("복구 가능 기간") || error.message.includes("탈퇴 상태")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "계정 복구 중 오류가 발생했습니다" });
    }
  });
}
