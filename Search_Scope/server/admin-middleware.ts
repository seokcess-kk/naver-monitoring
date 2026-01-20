import type { Request, Response, NextFunction } from "express";
import type { User, UserRole } from "@shared/schema";

export interface AdminRequest extends Request {
  user?: User;
  adminId?: string;
}

export function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({ error: "로그인이 필요합니다" });
  }
  
  if (user.role !== "admin" && user.role !== "superadmin") {
    return res.status(403).json({ error: "관리자 권한이 필요합니다" });
  }
  
  if (user.status !== "active") {
    return res.status(403).json({ error: "계정이 비활성화되었습니다" });
  }
  
  req.adminId = user.id;
  next();
}

export function requireSuperAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({ error: "로그인이 필요합니다" });
  }
  
  if (user.role !== "superadmin") {
    return res.status(403).json({ error: "슈퍼 관리자 권한이 필요합니다" });
  }
  
  if (user.status !== "active") {
    return res.status(403).json({ error: "계정이 비활성화되었습니다" });
  }
  
  req.adminId = user.id;
  next();
}
