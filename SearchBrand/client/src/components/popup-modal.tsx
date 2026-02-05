import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface Popup {
  id: string;
  title?: string;
  content: string;
  imageUrl: string | null;
  targetPage: string;
  priority: number;
  showDontShowToday: boolean;
  showNeverShow: boolean;
  isActive: boolean;
  startDate: string;
  endDate: string;
  createdAt: string;
}

const POPUP_STORAGE_KEY = "searchbrand-popup-dismissed";

interface DismissedPopups {
  today: { [popupId: string]: string };
  permanent: string[];
}

function getDismissedPopups(): DismissedPopups {
  try {
    const stored = localStorage.getItem(POPUP_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // 무시
  }
  return { today: {}, permanent: [] };
}

function saveDismissedPopups(data: DismissedPopups) {
  localStorage.setItem(POPUP_STORAGE_KEY, JSON.stringify(data));
}

function isPopupDismissed(popupId: string): boolean {
  const dismissed = getDismissedPopups();
  
  if (dismissed.permanent.includes(popupId)) {
    return true;
  }
  
  const todayDate = new Date().toDateString();
  if (dismissed.today[popupId] === todayDate) {
    return true;
  }
  
  return false;
}

function dismissPopupForToday(popupId: string) {
  const dismissed = getDismissedPopups();
  dismissed.today[popupId] = new Date().toDateString();
  
  const todayDate = new Date().toDateString();
  Object.keys(dismissed.today).forEach((key) => {
    if (dismissed.today[key] !== todayDate) {
      delete dismissed.today[key];
    }
  });
  
  saveDismissedPopups(dismissed);
}

function dismissPopupPermanently(popupId: string) {
  const dismissed = getDismissedPopups();
  if (!dismissed.permanent.includes(popupId)) {
    dismissed.permanent.push(popupId);
  }
  saveDismissedPopups(dismissed);
}

// 인증이 필요한 경로 목록
const PROTECTED_ROUTES = ["/dashboard", "/search", "/place-review", "/profile", "/admin"];

function getPageKey(pathname: string, isAuthenticated: boolean): string {
  // 명시적 인증 페이지
  if (pathname.includes("/auth") || pathname.includes("/login") || 
      pathname.includes("/reset-password") || pathname.includes("/complete-signup")) {
    return "auth";
  }
  
  // 비로그인 상태에서 인증 필요 경로 접근 시 → auth로 분류
  if (!isAuthenticated) {
    const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.includes(route));
    if (isProtectedRoute) {
      return "auth";
    }
  }
  
  if (pathname === "/" || pathname === "") {
    return isAuthenticated ? "place-review" : "landing";
  }
  if (pathname.includes("/dashboard") || pathname.includes("/search")) {
    return "dashboard";
  }
  if (pathname.includes("/place-review")) {
    return "place-review";
  }
  if (pathname.includes("/profile")) {
    return "profile";
  }
  if (pathname.includes("/admin")) {
    return "admin";
  }
  return "none";
}

export function PopupModal() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();
  const [currentPopupIndex, setCurrentPopupIndex] = useState(0);
  const [visiblePopups, setVisiblePopups] = useState<Popup[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  
  const pageKey = getPageKey(location, isAuthenticated);
  
  const { data: activePopups } = useQuery<Popup[]>({
    queryKey: ["/api/popups/active", pageKey],
    queryFn: async () => {
      const url = pageKey && pageKey !== "auth" && pageKey !== "none"
        ? `/api/popups/active?targetPage=${encodeURIComponent(pageKey)}`
        : "/api/popups/active";
      const res = await apiRequest("GET", url);
      return res.json();
    },
    enabled: pageKey !== "auth" && pageKey !== "none",
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
  
  useEffect(() => {
    // 인증 페이지에서는 모든 팝업 차단
    if (pageKey === "auth" || pageKey === "none") {
      setVisiblePopups([]);
      setIsOpen(false);
      return;
    }
    
    if (!activePopups?.length) {
      setVisiblePopups([]);
      setIsOpen(false);
      return;
    }
    
    const filtered = activePopups.filter((popup) => {
      if (isPopupDismissed(popup.id)) {
        return false;
      }
      
      if (popup.targetPage === "all") {
        return true;
      }
      
      return popup.targetPage === pageKey;
    });
    
    filtered.sort((a, b) => b.priority - a.priority);
    setVisiblePopups(filtered);
    setCurrentPopupIndex(0);
    setIsOpen(filtered.length > 0);
  }, [activePopups, pageKey]);
  
  const currentPopup = visiblePopups[currentPopupIndex];
  
  const handleClose = () => {
    if (currentPopupIndex < visiblePopups.length - 1) {
      setCurrentPopupIndex((prev) => prev + 1);
    } else {
      setIsOpen(false);
    }
  };
  
  const handleHideToday = () => {
    if (currentPopup) {
      dismissPopupForToday(currentPopup.id);
      handleClose();
    }
  };
  
  const handleDontShowAgain = () => {
    if (currentPopup) {
      dismissPopupPermanently(currentPopup.id);
      handleClose();
    }
  };
  
  if (!currentPopup) {
    return null;
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="sr-only">팝업 알림</DialogTitle>
          {visiblePopups.length > 1 && (
            <div className="text-sm text-muted-foreground text-right mr-8">
              {currentPopupIndex + 1} / {visiblePopups.length}
            </div>
          )}
        </DialogHeader>
        
        <div className="space-y-4">
          {currentPopup.imageUrl && (
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
              <img
                src={currentPopup.imageUrl}
                alt="팝업 이미지"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
          
          <DialogDescription className="text-base text-foreground" asChild>
            <div dangerouslySetInnerHTML={{ __html: currentPopup.content }} />
          </DialogDescription>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t">
          <div className="flex gap-2 flex-1">
            {currentPopup.showDontShowToday && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleHideToday}
                className="flex-1"
              >
                오늘 하루 안 보기
              </Button>
            )}
            {currentPopup.showNeverShow && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDontShowAgain}
                className="flex-1"
              >
                다시 보지 않기
              </Button>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleClose}
            className="sm:w-auto"
          >
            {currentPopupIndex < visiblePopups.length - 1 ? "다음" : "닫기"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
