import { useState, useEffect } from "react";
import { MessageCircle, X } from "lucide-react";
import { FeedbackModal } from "./FeedbackModal";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!dismissed) {
        setShowTooltip(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [dismissed]);

  const handleDismissTooltip = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTooltip(false);
    setDismissed(true);
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {showTooltip && !open && (
          <div className="relative animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-4 py-3 max-w-[220px]">
              <button
                onClick={handleDismissTooltip}
                className="absolute -top-2 -right-2 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition-colors"
              >
                <X className="h-3 w-3 text-gray-500" />
              </button>
              <p className="text-sm font-medium text-gray-900">
                한 마디만 남겨주세요🙏
              </p>
              <p className="text-xs text-gray-500 mt-1">
                💬 서비스 개선에 큰 힘이 됩니다
              </p>
            </div>
            <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white border-r border-b border-gray-100 rotate-45" />
          </div>
        )}

        <button
          onClick={() => setOpen(true)}
          className="group relative w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center hover:scale-105"
          aria-label="피드백 보내기"
        >
          <MessageCircle className="h-6 w-6 text-white" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        </button>
      </div>

      <FeedbackModal open={open} onOpenChange={setOpen} />
    </>
  );
}
