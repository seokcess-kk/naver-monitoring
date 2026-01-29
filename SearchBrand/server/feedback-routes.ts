import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { getUncachableSendGridClient } from "./email-service";
import type { FeedbackCategory } from "@shared/schema";

const router = Router();

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const feedbackSchema = z.object({
  category: z.enum(["feature", "inquiry", "bug"]),
  content: z.string().min(10, "피드백 내용은 최소 10자 이상이어야 합니다").max(5000, "피드백 내용은 5000자 이하여야 합니다"),
  screenshotUrl: z.string().url().optional().nullable(),
  pageUrl: z.string().url().optional().or(z.literal("")),
  userAgent: z.string().optional(),
});

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  feature: "기능요청",
  inquiry: "문의",
  bug: "오류",
};

async function sendFeedbackNotificationEmail(feedback: {
  id: string;
  category: FeedbackCategory;
  content: string;
  pageUrl?: string | null;
  userEmail?: string | null;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || fromEmail;
    
    await client.send({
      to: adminEmail,
      from: fromEmail,
      subject: `[SearchBrand] 새 피드백: ${CATEGORY_LABELS[feedback.category]}`,
      html: `
        <div style="font-family: 'Apple SD Gothic Neo', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">새로운 피드백이 접수되었습니다</h1>
          </div>
          <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; width: 100px;">카테고리</td>
                <td style="padding: 8px 0; font-weight: 600;">${CATEGORY_LABELS[feedback.category]}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">사용자</td>
                <td style="padding: 8px 0;">${escapeHtml(feedback.userEmail || "비로그인 사용자")}</td>
              </tr>
              ${feedback.pageUrl ? `
              <tr>
                <td style="padding: 8px 0; color: #64748b;">페이지</td>
                <td style="padding: 8px 0;"><a href="${escapeHtml(feedback.pageUrl)}" style="color: #0ea5e9;">${escapeHtml(feedback.pageUrl)}</a></td>
              </tr>
              ` : ""}
            </table>
            <div style="margin-top: 16px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #334155; white-space: pre-wrap;">${escapeHtml(feedback.content)}</p>
            </div>
            <div style="margin-top: 24px; text-align: center;">
              <a href="${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : 'http://localhost:5000'}/admin?tab=feedback" 
                 style="display: inline-block; padding: 12px 24px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
                관리자 콘솔에서 확인
              </a>
            </div>
          </div>
        </div>
      `,
    });
    console.log(`[Feedback] 알림 이메일 발송 완료: ${feedback.id}`);
  } catch (error) {
    console.error("[Feedback] 알림 이메일 발송 실패:", error);
  }
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const result = feedbackSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        message: "유효하지 않은 요청입니다", 
        errors: result.error.flatten().fieldErrors 
      });
    }

    const userId = (req as any).user?.id || null;
    const userEmail = (req as any).user?.email || null;

    const feedback = await storage.createFeedback({
      ...result.data,
      userId,
    });

    sendFeedbackNotificationEmail({
      id: feedback.id,
      category: feedback.category as FeedbackCategory,
      content: feedback.content,
      pageUrl: feedback.pageUrl,
      userEmail,
    });

    res.status(201).json({ 
      message: "피드백이 성공적으로 제출되었습니다",
      id: feedback.id 
    });
  } catch (error) {
    console.error("[Feedback] 제출 실패:", error);
    res.status(500).json({ message: "피드백 제출 중 오류가 발생했습니다" });
  }
});

export default router;
