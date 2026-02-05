import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, CheckCircle, AlertCircle, Lightbulb, HelpCircle, Bug } from "lucide-react";

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FeedbackCategory = "feature" | "inquiry" | "bug";

const CATEGORY_CONFIG: Record<FeedbackCategory, { label: string; icon: typeof Lightbulb; color: string }> = {
  feature: { label: "기능요청", icon: Lightbulb, color: "text-amber-500" },
  inquiry: { label: "문의", icon: HelpCircle, color: "text-blue-500" },
  bug: { label: "오류", icon: Bug, color: "text-red-500" },
};

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const [category, setCategory] = useState<FeedbackCategory>("inquiry");
  const [content, setContent] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: async (data: { category: FeedbackCategory; content: string; pageUrl: string; userAgent: string }) => {
      return apiRequest("POST", "/api/feedback", data);
    },
    onSuccess: () => {
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setCategory("inquiry");
        setContent("");
        onOpenChange(false);
      }, 2000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim().length < 10) return;
    
    submitMutation.mutate({
      category,
      content: content.trim(),
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>피드백 보내기</DialogTitle>
          <DialogDescription>
            서비스 개선을 위한 소중한 의견을 보내주세요
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-lg font-medium">피드백이 제출되었습니다</p>
            <p className="text-sm text-muted-foreground mt-1">소중한 의견 감사합니다</p>
          </div>
        ) : (
          <form id="feedback-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label>카테고리</Label>
              <div className="flex gap-3">
                {(Object.entries(CATEGORY_CONFIG) as [FeedbackCategory, typeof CATEGORY_CONFIG["feature"]][]).map(
                  ([value, { label, icon: Icon, color }]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCategory(value)}
                      className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border transition-colors ${
                        category === value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${color}`} />
                      <span className="text-sm font-medium">{label}</span>
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-content">내용</Label>
              <Textarea
                id="feedback-content"
                placeholder="피드백 내용을 입력해주세요 (최소 10자)"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {content.length} / 5000자
              </p>
            </div>

            {submitMutation.isError && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" />
                <span>피드백 제출 중 오류가 발생했습니다</span>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={content.trim().length < 10 || submitMutation.isPending}
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    제출 중...
                  </>
                ) : (
                  "피드백 보내기"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
