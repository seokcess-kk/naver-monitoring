import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, MessageSquare, RefreshCw, Zap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { 
  UserActivityInsights, 
  PlaceReviewInsights, 
  SystemPerformanceInsights,
  DateRangeOption 
} from "./types";

export function InsightsTab() {
  const [dateRange, setDateRange] = useState<DateRangeOption>("7d");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [excludeInactive, setExcludeInactive] = useState<boolean>(true);

  const getDateParams = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let startDate: Date;
    let endDate: Date = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    switch (dateRange) {
      case "today":
        startDate = today;
        break;
      case "7d":
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "custom":
        startDate = customStartDate ? new Date(customStartDate) : new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = customEndDate ? new Date(new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000) : endDate;
        break;
      default:
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  };

  const dateParams = getDateParams();
  const queryParams = `?startDate=${encodeURIComponent(dateParams.startDate)}&endDate=${encodeURIComponent(dateParams.endDate)}`;

  const userActivityParams = `${queryParams}&excludeInactive=${excludeInactive}`;
  const { data: userActivity, isLoading: loadingUser, refetch: refetchUser } = useQuery<UserActivityInsights>({
    queryKey: ["/api/admin/insights/user-activity", dateRange, customStartDate, customEndDate, excludeInactive],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/insights/user-activity${userActivityParams}`);
      return res.json();
    },
  });

  const { data: placeReviews, isLoading: loadingPlace, refetch: refetchPlace } = useQuery<PlaceReviewInsights>({
    queryKey: ["/api/admin/insights/place-reviews", dateRange, customStartDate, customEndDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/insights/place-reviews${queryParams}`);
      return res.json();
    },
  });

  const { data: systemPerf, isLoading: loadingSystem, refetch: refetchSystem } = useQuery<SystemPerformanceInsights>({
    queryKey: ["/api/admin/insights/system-performance", dateRange, customStartDate, customEndDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/insights/system-performance${queryParams}`);
      return res.json();
    },
  });

  const handleRefreshAll = () => {
    refetchUser();
    refetchPlace();
    refetchSystem();
  };

  const getDateRangeLabel = () => {
    switch (dateRange) {
      case "today": return "오늘";
      case "7d": return "최근 7일";
      case "30d": return "최근 30일";
      case "custom": 
        if (customStartDate && customEndDate) {
          return `${customStartDate} ~ ${customEndDate}`;
        }
        return "사용자 지정";
      default: return "최근 7일";
    }
  };

  const getSentimentLabel = (sentiment: string) => {
    const labels: Record<string, string> = {
      Positive: "긍정",
      Negative: "부정",
      Neutral: "중립",
    };
    return labels[sentiment] || sentiment;
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "Positive": return "text-green-600";
      case "Negative": return "text-red-600";
      default: return "text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-medium">데이터 인사이트</h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button 
              variant={dateRange === "today" ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setDateRange("today")}
              className="h-7 px-2 text-xs"
            >
              오늘
            </Button>
            <Button 
              variant={dateRange === "7d" ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setDateRange("7d")}
              className="h-7 px-2 text-xs"
            >
              7일
            </Button>
            <Button 
              variant={dateRange === "30d" ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setDateRange("30d")}
              className="h-7 px-2 text-xs"
            >
              30일
            </Button>
            <Button 
              variant={dateRange === "custom" ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setDateRange("custom")}
              className="h-7 px-2 text-xs"
            >
              지정
            </Button>
          </div>
          {dateRange === "custom" && (
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-7 w-32 text-xs"
              />
              <span className="text-muted-foreground">~</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-7 w-32 text-xs"
              />
            </div>
          )}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input 
              type="checkbox" 
              checked={excludeInactive}
              onChange={(e) => setExcludeInactive(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300"
            />
            비활성 계정 제외
          </label>
          <Button variant="outline" size="sm" onClick={handleRefreshAll} className="h-7">
            <RefreshCw className="w-3 h-3 mr-1" />
            새로고침
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              활성 사용자
              <span className="text-xs font-normal text-muted-foreground">({getDateRangeLabel()})</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">검색, 리뷰 분석 중 하나 이상 사용한 사용자</p>
          </CardHeader>
          <CardContent>
            {loadingUser ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">활성 사용자 수</span>
                  <span className="font-semibold">{userActivity?.activeUsers.period || 0}명</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">총 활동 수</span>
                  <span className="font-semibold">{userActivity?.activeUsers.totalActivities || 0}건</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">검색</span>
                    <span>{userActivity?.activeUsers.breakdown?.searches || 0}건</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">리뷰 분석</span>
                    <span>{userActivity?.activeUsers.breakdown?.placeReviews || 0}건</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              플레이스 리뷰 현황
              <span className="text-xs font-normal text-muted-foreground">({getDateRangeLabel()})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPlace ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">분석 작업</span>
                  <span className="font-semibold">{placeReviews?.summary.completedJobs || 0}건</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">분석 리뷰</span>
                  <span className="font-semibold">{placeReviews?.summary.totalReviews || 0}개</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">인기 검색 키워드 ({getDateRangeLabel()})</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingUser ? (
              <Skeleton className="h-40 w-full" />
            ) : userActivity?.popularKeywords.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다</p>
            ) : (
              <div className="space-y-2">
                {userActivity?.popularKeywords.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-5">{idx + 1}</span>
                      <span className="text-sm">{item.keyword}</span>
                    </div>
                    <Badge variant="secondary">{item.count}회</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">리뷰 감성 분포</CardTitle>
            <p className="text-xs text-muted-foreground">분석된 리뷰 기준 ({placeReviews?.summary.analyzedReviews || 0}건)</p>
          </CardHeader>
          <CardContent>
            {loadingPlace ? (
              <Skeleton className="h-24 w-full" />
            ) : (placeReviews?.summary.analyzedReviews || 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">분석된 리뷰가 없습니다</p>
            ) : placeReviews?.sentimentDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">감성 분석 데이터가 없습니다</p>
            ) : (
              <div className="space-y-3">
                {placeReviews?.sentimentDistribution.map((item) => (
                  <div key={item.sentiment} className="flex items-center justify-between">
                    <span className={`font-medium ${getSentimentColor(item.sentiment)}`}>
                      {getSentimentLabel(item.sentiment)}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-muted rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${item.sentiment === "Positive" ? "bg-green-500" : item.sentiment === "Negative" ? "bg-red-500" : "bg-gray-500"}`}
                          style={{ width: `${Math.min(100, (item.count / (placeReviews.summary.analyzedReviews || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-16 text-right">
                        {item.count}개 ({Math.round((item.count / (placeReviews.summary.analyzedReviews || 1)) * 100)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">인기 플레이스</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPlace ? (
              <Skeleton className="h-24 w-full" />
            ) : placeReviews?.popularPlaces.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다</p>
            ) : (
              <div className="space-y-2">
                {placeReviews?.popularPlaces.slice(0, 5).map((place, idx) => (
                  <div key={place.placeId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-5">{idx + 1}</span>
                      <span className="text-sm truncate max-w-48">{place.placeName || place.placeId}</span>
                    </div>
                    <Badge variant="outline">{place.totalReviews || 0}개 리뷰</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">채널별 검색 현황 ({getDateRangeLabel()})</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingUser ? (
              <Skeleton className="h-24 w-full" />
            ) : userActivity?.searchByType.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다</p>
            ) : (
              <div className="space-y-3">
                {userActivity?.searchByType.map((item) => {
                  const totalSearches = userActivity.searchByType.reduce((sum, i) => sum + i.count, 0);
                  const percentage = totalSearches > 0 ? Math.round((item.count / totalSearches) * 100) : 0;
                  const channelLabels: Record<string, string> = {
                    unified: "통합검색",
                    blog: "블로그",
                    cafe: "카페",
                    kin: "지식iN",
                    news: "뉴스",
                  };
                  return (
                    <div key={item.searchType} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{channelLabels[item.searchType] || item.searchType}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-muted rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${percentage}%` }} />
                        </div>
                        <span className="text-sm w-16 text-right">{item.count}회</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">일별 검색 추이 ({getDateRangeLabel()})</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingUser ? (
              <Skeleton className="h-24 w-full" />
            ) : userActivity?.dailySearchTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다</p>
            ) : (
              <div className="space-y-2">
                {userActivity?.dailySearchTrend.map((item) => {
                  const maxCount = Math.max(...(userActivity?.dailySearchTrend.map(d => d.count) || [1]));
                  const percentage = maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0;
                  const dateStr = new Date(item.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
                  return (
                    <div key={item.date} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground w-16">{dateStr}</span>
                      <div className="flex items-center gap-2 flex-1 ml-2">
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: `${percentage}%` }} />
                        </div>
                        <span className="text-sm w-12 text-right">{item.count}건</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">플레이스 리뷰 일별 분석 ({getDateRangeLabel()})</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPlace ? (
              <Skeleton className="h-24 w-full" />
            ) : placeReviews?.dailyJobTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다</p>
            ) : (
              <div className="space-y-2">
                {placeReviews?.dailyJobTrend.map((item) => {
                  const dateStr = new Date(item.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
                  return (
                    <div key={item.date} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground w-16">{dateStr}</span>
                      <div className="flex gap-4">
                        <span>전체: <span className="font-medium">{item.total}</span></span>
                        <span className="text-green-600">완료: {item.completed}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 border-t pt-6">
        <h4 className="text-base font-medium mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4" />
          시스템 성능 ({getDateRangeLabel()})
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-2">API 검색 요청</div>
              {loadingSystem ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">총 검색 요청</span>
                    <span className="font-semibold">{systemPerf?.apiUsage.totalSearches || 0}건</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-2">플레이스 리뷰 큐</div>
              {loadingSystem ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">성공률</span>
                    <span className="font-semibold text-green-600">{systemPerf?.placeReviewQueue.successRate || 0}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">대기/처리중</span>
                    <span>{systemPerf?.placeReviewQueue.pending || 0} / {systemPerf?.placeReviewQueue.processing || 0}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
