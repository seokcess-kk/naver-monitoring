import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Zap, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { AdminUser, UserUsageStats, API_TYPE_LABELS } from "./types";

const API_LABELS: Record<string, string> = {
  naver_search: "네이버 검색",
  naver_ad: "네이버 광고",
  openai: "OpenAI",
  browserless: "Browserless",
};

interface UserDetailModalProps {
  user: AdminUser | null;
  open: boolean;
  onClose: () => void;
}

export function UserDetailModal({ user, open, onClose }: UserDetailModalProps) {
  const { data: usageStats, isLoading } = useQuery<UserUsageStats>({
    queryKey: ["admin-user-usage", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("No user");
      const res = await apiRequest("GET", `/api/admin/users/${user.id}/usage`);
      return res.json();
    },
    enabled: !!user && open,
  });
  
  if (!user) return null;
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            사용자 상세 정보
          </DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">역할</p>
              <p className="font-medium">{user.role}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">상태</p>
              <p className="font-medium">{user.status}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">이메일 인증</p>
              <p className="font-medium">{user.emailVerified ? "완료" : "미완료"}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">마지막 활동</p>
              <p className="font-medium text-sm">
                {usageStats?.lastActivityAt 
                  ? new Date(usageStats.lastActivityAt).toLocaleDateString('ko-KR')
                  : "없음"}
              </p>
            </div>
          </div>
          
          {isLoading ? (
            <Skeleton className="h-40" />
          ) : (
            <>
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  API 사용량
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {usageStats?.apiUsage.map(api => (
                    <div key={api.apiType} className="border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">
                        {API_LABELS[api.apiType] || api.apiType}
                      </p>
                      <p className="text-lg font-bold">{api.totalCalls}</p>
                      <p className="text-xs text-muted-foreground">
                        토큰: {api.totalTokens.toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {(!usageStats?.apiUsage || usageStats.apiUsage.length === 0) && (
                    <p className="col-span-4 text-center text-muted-foreground py-4">
                      API 사용 기록이 없습니다
                    </p>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  최근 활동
                </h3>
                <Tabs defaultValue="searches" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="searches">검색 ({usageStats?.recentActivity.searches.length || 0})</TabsTrigger>
                    <TabsTrigger value="sov">SOV ({usageStats?.recentActivity.sovRuns.length || 0})</TabsTrigger>
                    <TabsTrigger value="reviews">리뷰 ({usageStats?.recentActivity.placeReviews.length || 0})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="searches" className="mt-3">
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {usageStats?.recentActivity.searches.map(s => (
                        <div key={s.id} className="flex justify-between items-center text-sm border-b pb-2">
                          <span className="truncate max-w-[200px]">{s.keyword}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(s.createdAt).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                      ))}
                      {(!usageStats?.recentActivity.searches || usageStats.recentActivity.searches.length === 0) && (
                        <p className="text-center text-muted-foreground py-4">없음</p>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="sov" className="mt-3">
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {usageStats?.recentActivity.sovRuns.map(s => (
                        <div key={s.id} className="flex justify-between items-center text-sm border-b pb-2">
                          <span className="truncate max-w-[200px]">{s.marketKeyword}</span>
                          <Badge variant={s.status === 'completed' ? 'default' : 'secondary'}>{s.status}</Badge>
                        </div>
                      ))}
                      {(!usageStats?.recentActivity.sovRuns || usageStats.recentActivity.sovRuns.length === 0) && (
                        <p className="text-center text-muted-foreground py-4">없음</p>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="reviews" className="mt-3">
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {usageStats?.recentActivity.placeReviews.map(s => (
                        <div key={s.id} className="flex justify-between items-center text-sm border-b pb-2">
                          <span className="truncate max-w-[200px]">{s.placeName || s.placeId}</span>
                          <Badge variant={s.status === 'completed' ? 'default' : 'secondary'}>{s.status}</Badge>
                        </div>
                      ))}
                      {(!usageStats?.recentActivity.placeReviews || usageStats.recentActivity.placeReviews.length === 0) && (
                        <p className="text-center text-muted-foreground py-4">없음</p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
