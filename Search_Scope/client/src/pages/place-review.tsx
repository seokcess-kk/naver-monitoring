import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/header";
import { StatCardsSkeleton, ReviewListSkeleton, AspectBarsSkeleton, InsightCardSkeleton } from "@/components/ui/results-skeleton";
import { ServiceStatusAlert, useServiceStatus } from "@/components/service-status-alert";
import { 
  Loader2, Play, Trash2, BarChart3, MessageSquare, TrendingUp, TrendingDown, Minus, 
  RefreshCw, Search, Filter, Download, RotateCcw, AlertTriangle, Lightbulb, ChevronLeft, ChevronRight,
  Calendar, ArrowUpDown
} from "lucide-react";

interface PlaceReviewJob {
  id: string;
  placeId: string;
  placeName: string | null;
  mode: string;
  status: string;
  statusMessage: string | null;
  progress: string;
  totalReviews: string;
  analyzedReviews: string;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface ReviewWithAnalysis {
  id: string;
  reviewText: string;
  reviewDate: string;
  authorName: string | null;
  rating: string | null;
  sentiment: string | null;
  aspects: Array<{ aspect: string; sentiment: string }>;
  keywords: string[];
  summary: string | null;
}

interface JobStats {
  job: PlaceReviewJob;
  sentimentStats: Array<{ sentiment: string; count: number }>;
  aspectStats: Array<{ aspect: string; Positive: number; Negative: number; Neutral: number; total: number }>;
  topKeywords: Array<{ keyword: string; count: number }>;
}

type ScrapeMode = "QTY" | "DATE" | "DATE_RANGE";
type SentimentFilter = "all" | "Positive" | "Negative" | "Neutral";
type SortOrder = "date-desc" | "date-asc" | "sentiment";

function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  if (!sentiment) return <Badge variant="outline">-</Badge>;
  
  const config: Record<string, { variant: "default" | "destructive" | "secondary"; icon: React.ReactNode }> = {
    Positive: { variant: "default", icon: <TrendingUp className="w-3 h-3 mr-1" /> },
    Negative: { variant: "destructive", icon: <TrendingDown className="w-3 h-3 mr-1" /> },
    Neutral: { variant: "secondary", icon: <Minus className="w-3 h-3 mr-1" /> },
  };
  
  const { variant, icon } = config[sentiment] || config.Neutral;
  const label = sentiment === "Positive" ? "긍정" : sentiment === "Negative" ? "부정" : "중립";
  
  return (
    <Badge variant={variant} className="flex items-center">
      {icon}
      {label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: "default" | "destructive" | "secondary" | "outline"; label: string }> = {
    queued: { variant: "outline", label: "대기중" },
    processing: { variant: "secondary", label: "처리중" },
    completed: { variant: "default", label: "완료" },
    failed: { variant: "destructive", label: "실패" },
  };
  
  const { variant, label } = config[status] || { variant: "outline", label: status };
  
  return <Badge variant={variant}>{label}</Badge>;
}

function InsightCard({ stats, reviews }: { stats: JobStats | undefined; reviews: ReviewWithAnalysis[] }) {
  if (!stats || reviews.length === 0) return null;

  const sentimentCounts = {
    Positive: stats.sentimentStats.find((s) => s.sentiment === "Positive")?.count || 0,
    Negative: stats.sentimentStats.find((s) => s.sentiment === "Negative")?.count || 0,
    Neutral: stats.sentimentStats.find((s) => s.sentiment === "Neutral")?.count || 0,
  };
  const total = sentimentCounts.Positive + sentimentCounts.Negative + sentimentCounts.Neutral;
  const negativeRatio = total > 0 ? (sentimentCounts.Negative / total) * 100 : 0;

  const topNegativeAspects = stats.aspectStats
    .filter(a => a.Negative > 0)
    .sort((a, b) => b.Negative - a.Negative)
    .slice(0, 3);

  const topPositiveAspects = stats.aspectStats
    .filter(a => a.Positive > 0)
    .sort((a, b) => b.Positive - a.Positive)
    .slice(0, 3);

  const insights: { type: "warning" | "success" | "info"; title: string; description: string }[] = [];

  if (negativeRatio >= 30) {
    insights.push({
      type: "warning",
      title: `부정 리뷰 비율 ${negativeRatio.toFixed(0)}%`,
      description: topNegativeAspects.length > 0 
        ? `주요 불만 요소: ${topNegativeAspects.map(a => a.aspect).join(", ")}`
        : "부정적인 리뷰가 많습니다. 개선이 필요합니다."
    });
  } else if (negativeRatio >= 15) {
    insights.push({
      type: "info",
      title: `부정 리뷰 비율 ${negativeRatio.toFixed(0)}%`,
      description: topNegativeAspects.length > 0 
        ? `관심 필요: ${topNegativeAspects.map(a => a.aspect).join(", ")}`
        : "일부 개선이 필요한 부분이 있습니다."
    });
  }

  if (topPositiveAspects.length > 0 && sentimentCounts.Positive > sentimentCounts.Negative) {
    insights.push({
      type: "success",
      title: "강점 요소",
      description: `고객이 좋아하는 점: ${topPositiveAspects.map(a => a.aspect).join(", ")}`
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: "info",
      title: "분석 완료",
      description: `총 ${total}개 리뷰 분석됨. 긍정 ${sentimentCounts.Positive}건, 부정 ${sentimentCounts.Negative}건`
    });
  }

  const iconConfig = {
    warning: { icon: AlertTriangle, bg: "bg-red-500/10", text: "text-red-500" },
    success: { icon: TrendingUp, bg: "bg-green-500/10", text: "text-green-500" },
    info: { icon: Lightbulb, bg: "bg-blue-500/10", text: "text-blue-500" },
  };

  return (
    <div className="space-y-3">
      {insights.map((insight, idx) => {
        const config = iconConfig[insight.type];
        const Icon = config.icon;
        return (
          <Card key={idx} className={`border-l-4 ${insight.type === 'warning' ? 'border-l-red-500' : insight.type === 'success' ? 'border-l-green-500' : 'border-l-blue-500'}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${config.bg} shrink-0`}>
                  <Icon className={`w-5 h-5 ${config.text}`} />
                </div>
                <div>
                  <p className="font-semibold text-sm">{insight.title}</p>
                  <p className="text-sm text-muted-foreground">{insight.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function KeywordSentimentChart({ stats, reviews }: { stats: JobStats | undefined; reviews: ReviewWithAnalysis[] }) {
  const keywordSentiments = useMemo(() => {
    const map: Record<string, { positive: number; negative: number; neutral: number }> = {};
    
    reviews.forEach(review => {
      review.keywords.forEach(kw => {
        if (!map[kw]) map[kw] = { positive: 0, negative: 0, neutral: 0 };
        if (review.sentiment === "Positive") map[kw].positive++;
        else if (review.sentiment === "Negative") map[kw].negative++;
        else map[kw].neutral++;
      });
    });

    return Object.entries(map)
      .map(([keyword, counts]) => ({
        keyword,
        ...counts,
        total: counts.positive + counts.negative + counts.neutral
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [reviews]);

  if (keywordSentiments.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          키워드 데이터가 없습니다
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">키워드별 감정 분포</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {keywordSentiments.map((kw) => (
          <div key={kw.keyword} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{kw.keyword}</span>
              <span className="text-muted-foreground">{kw.total}건</span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
              {kw.positive > 0 && (
                <div
                  className="bg-green-500 transition-all"
                  style={{ width: `${(kw.positive / kw.total) * 100}%` }}
                  title={`긍정: ${kw.positive}건`}
                />
              )}
              {kw.neutral > 0 && (
                <div
                  className="bg-gray-400 transition-all"
                  style={{ width: `${(kw.neutral / kw.total) * 100}%` }}
                  title={`중립: ${kw.neutral}건`}
                />
              )}
              {kw.negative > 0 && (
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${(kw.negative / kw.total) * 100}%` }}
                  title={`부정: ${kw.negative}건`}
                />
              )}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500" /> 긍정</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-400" /> 중립</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" /> 부정</span>
        </div>
      </CardContent>
    </Card>
  );
}

function SentimentTrendChart({ reviews }: { reviews: ReviewWithAnalysis[] }) {
  const trendData = useMemo(() => {
    const grouped: Record<string, { positive: number; negative: number; neutral: number }> = {};
    
    reviews.forEach(review => {
      const date = new Date(review.reviewDate).toISOString().split('T')[0];
      if (!grouped[date]) grouped[date] = { positive: 0, negative: 0, neutral: 0 };
      if (review.sentiment === "Positive") grouped[date].positive++;
      else if (review.sentiment === "Negative") grouped[date].negative++;
      else grouped[date].neutral++;
    });

    return Object.entries(grouped)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([date, counts]) => ({
        date: new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
        ...counts,
        total: counts.positive + counts.negative + counts.neutral
      }));
  }, [reviews]);

  if (trendData.length < 2) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          추이를 보려면 2일 이상의 데이터가 필요합니다
        </CardContent>
      </Card>
    );
  }

  const maxTotal = Math.max(...trendData.map(d => d.total));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          날짜별 감정 추이
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1 h-32">
          {trendData.map((day, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
              <div 
                className="w-full flex flex-col-reverse rounded-t overflow-hidden"
                style={{ height: `${(day.total / maxTotal) * 100}%`, minHeight: '4px' }}
              >
                {day.positive > 0 && (
                  <div 
                    className="bg-green-500 w-full" 
                    style={{ height: `${(day.positive / day.total) * 100}%` }}
                  />
                )}
                {day.neutral > 0 && (
                  <div 
                    className="bg-gray-400 w-full" 
                    style={{ height: `${(day.neutral / day.total) * 100}%` }}
                  />
                )}
                {day.negative > 0 && (
                  <div 
                    className="bg-red-500 w-full" 
                    style={{ height: `${(day.negative / day.total) * 100}%` }}
                  />
                )}
              </div>
              <span className="text-[9px] text-muted-foreground truncate w-full text-center">{day.date}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateJobForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [placeId, setPlaceId] = useState("");
  const [mode, setMode] = useState<ScrapeMode>("QTY");
  const [limitQty, setLimitQty] = useState("50");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: any = { placeId, mode };
      if (mode === "QTY") body.limitQty = parseInt(limitQty);
      if (mode === "DATE" || mode === "DATE_RANGE") body.startDate = startDate;
      if (mode === "DATE_RANGE") body.endDate = endDate;

      const res = await fetch("/api/place-review/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "작업 생성 실패");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "분석 시작", description: `작업 ID: ${data.jobId}` });
      setPlaceId("");
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>새 리뷰 분석</CardTitle>
        <CardDescription>네이버 플레이스 리뷰를 수집하고 감정 분석을 수행합니다</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="placeId">플레이스 ID</Label>
          <Input
            id="placeId"
            placeholder="예: 1414590796"
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            네이버 플레이스 URL에서 place/ 뒤의 숫자를 입력하세요
          </p>
        </div>

        <div className="space-y-2">
          <Label>수집 모드</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as ScrapeMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="QTY">개수 기준</SelectItem>
              <SelectItem value="DATE">날짜 이후</SelectItem>
              <SelectItem value="DATE_RANGE">날짜 범위</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {mode === "QTY" && (
          <div className="space-y-2">
            <Label htmlFor="limitQty">수집할 리뷰 수</Label>
            <Input
              id="limitQty"
              type="number"
              min="1"
              max="500"
              value={limitQty}
              onChange={(e) => setLimitQty(e.target.value)}
            />
          </div>
        )}

        {(mode === "DATE" || mode === "DATE_RANGE") && (
          <div className="space-y-2">
            <Label htmlFor="startDate">시작 날짜</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        )}

        {mode === "DATE_RANGE" && (
          <div className="space-y-2">
            <Label htmlFor="endDate">종료 날짜</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        )}

        <Button
          onClick={() => createMutation.mutate()}
          disabled={!placeId || createMutation.isPending}
          className="w-full"
        >
          {createMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              처리중...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              분석 시작
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function JobList({ 
  jobs, 
  onSelect, 
  selectedJobId, 
  onRetry 
}: { 
  jobs: PlaceReviewJob[]; 
  onSelect: (id: string) => void; 
  selectedJobId: string | null;
  onRetry: (job: PlaceReviewJob) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/place-review/jobs/${jobId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("삭제 실패");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["place-review-jobs"] });
      toast({ title: "삭제 완료" });
    },
    onError: () => {
      toast({ title: "삭제 실패", variant: "destructive" });
    },
  });

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium mb-1">아직 분석 작업이 없습니다</p>
          <p className="text-sm">위에서 플레이스 ID를 입력해 분석을 시작하세요</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <Card
          key={job.id}
          className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedJobId === job.id ? "ring-2 ring-primary" : ""}`}
          onClick={() => onSelect(job.id)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <span className="font-medium">{job.placeName || job.placeId}</span>
                  {job.placeName && (
                    <span className="text-xs text-muted-foreground">{job.placeId}</span>
                  )}
                </div>
                <StatusBadge status={job.status} />
              </div>
              <div className="flex items-center gap-1">
                {job.status === "failed" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetry(job);
                    }}
                    title="재시도"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMutation.mutate(job.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {job.status === "processing" && (
              <>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {job.statusMessage || "분석 진행 중"}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground/70">
                      {parseInt(job.totalReviews) > 0 && parseInt(job.progress) > 0
                        ? `예상: 약 ${Math.ceil((parseInt(job.totalReviews) - parseInt(job.analyzedReviews)) * 0.5)}초`
                        : "예상: 계산 중..."}
                    </span>
                    <span className="font-medium">{job.progress}%</span>
                  </span>
                </div>
                <Progress value={parseInt(job.progress)} className="h-2 mb-2" />
              </>
            )}
            {job.status === "queued" && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                {job.statusMessage || "대기 중..."}
              </div>
            )}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>리뷰: {job.totalReviews}</span>
              <span>분석: {job.analyzedReviews}</span>
              <span>{new Date(job.createdAt).toLocaleDateString("ko-KR")}</span>
            </div>
            {job.errorMessage && (
              <p className="mt-2 text-sm text-destructive">{job.errorMessage}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function JobResults({ jobId }: { jobId: string }) {
  const { toast } = useToast();
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("date-desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: statsData, isLoading: statsLoading } = useQuery<JobStats>({
    queryKey: ["place-review-stats", jobId],
    queryFn: async () => {
      const res = await fetch(`/api/place-review/jobs/${jobId}/stats`, { credentials: "include" });
      if (!res.ok) throw new Error("통계 조회 실패");
      return res.json();
    },
  });

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery<{ reviews: ReviewWithAnalysis[], job: { totalReviews: string; analyzedReviews: string } }>({
    queryKey: ["place-review-reviews", jobId],
    queryFn: async () => {
      const res = await fetch(`/api/place-review/jobs/${jobId}/reviews`, { credentials: "include" });
      if (!res.ok) throw new Error("리뷰 조회 실패");
      return res.json();
    },
  });

  const reviewJobInfo = reviewsData?.job;

  const stats = statsData;
  const allReviews = reviewsData?.reviews || [];

  const filteredReviews = useMemo(() => {
    let result = [...allReviews];
    
    if (sentimentFilter !== "all") {
      result = result.filter(r => r.sentiment === sentimentFilter);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.reviewText.toLowerCase().includes(query) ||
        r.keywords.some(k => k.toLowerCase().includes(query)) ||
        r.authorName?.toLowerCase().includes(query)
      );
    }
    
    result.sort((a, b) => {
      if (sortOrder === "date-desc") {
        return new Date(b.reviewDate).getTime() - new Date(a.reviewDate).getTime();
      } else if (sortOrder === "date-asc") {
        return new Date(a.reviewDate).getTime() - new Date(b.reviewDate).getTime();
      } else {
        const order = { Negative: 0, Neutral: 1, Positive: 2 };
        return (order[a.sentiment as keyof typeof order] ?? 1) - (order[b.sentiment as keyof typeof order] ?? 1);
      }
    });
    
    return result;
  }, [allReviews, sentimentFilter, searchQuery, sortOrder]);

  const totalPages = Math.ceil(filteredReviews.length / pageSize);
  const paginatedReviews = filteredReviews.slice((page - 1) * pageSize, page * pageSize);

  const handleSentimentCardClick = (sentiment: SentimentFilter) => {
    setSentimentFilter(sentiment === sentimentFilter ? "all" : sentiment);
    setPage(1);
  };

  const exportToCSV = () => {
    if (filteredReviews.length === 0) {
      toast({ title: "내보낼 데이터가 없습니다", variant: "destructive" });
      return;
    }

    const headers = ["날짜", "작성자", "감정", "리뷰 내용", "키워드", "요약"];
    const rows = filteredReviews.map(r => [
      new Date(r.reviewDate).toLocaleDateString("ko-KR"),
      r.authorName || "-",
      r.sentiment === "Positive" ? "긍정" : r.sentiment === "Negative" ? "부정" : "중립",
      `"${r.reviewText.replace(/"/g, '""')}"`,
      r.keywords.join(", "),
      r.summary || "-"
    ]);

    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `place-reviews-${jobId}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV 다운로드 완료", description: `${filteredReviews.length}건의 리뷰를 내보냈습니다` });
  };

  if (statsLoading || reviewsLoading) {
    return (
      <div className="space-y-6">
        <StatCardsSkeleton count={3} />
        <InsightCardSkeleton />
        <ReviewListSkeleton count={3} />
      </div>
    );
  }

  const sentimentCounts = {
    Positive: stats?.sentimentStats.find((s) => s.sentiment === "Positive")?.count || 0,
    Negative: stats?.sentimentStats.find((s) => s.sentiment === "Negative")?.count || 0,
    Neutral: stats?.sentimentStats.find((s) => s.sentiment === "Neutral")?.count || 0,
  };
  const total = sentimentCounts.Positive + sentimentCounts.Negative + sentimentCounts.Neutral;

  return (
    <div className="space-y-6">
      {stats?.job && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{stats.job.placeName || stats.job.placeId}</h2>
            {stats.job.placeName && (
              <p className="text-sm text-muted-foreground">플레이스 ID: {stats.job.placeId}</p>
            )}
          </div>
          <StatusBadge status={stats.job.status} />
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${sentimentFilter === "Positive" ? "ring-2 ring-green-500" : ""}`}
          onClick={() => handleSentimentCardClick("Positive")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">긍정</span>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-600">{sentimentCounts.Positive}</div>
            <div className="text-xs text-muted-foreground">
              {total > 0 ? Math.round((sentimentCounts.Positive / total) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${sentimentFilter === "Negative" ? "ring-2 ring-red-500" : ""}`}
          onClick={() => handleSentimentCardClick("Negative")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">부정</span>
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-600">{sentimentCounts.Negative}</div>
            <div className="text-xs text-muted-foreground">
              {total > 0 ? Math.round((sentimentCounts.Negative / total) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${sentimentFilter === "Neutral" ? "ring-2 ring-gray-500" : ""}`}
          onClick={() => handleSentimentCardClick("Neutral")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">중립</span>
              <Minus className="w-4 h-4 text-gray-500" />
            </div>
            <div className="text-2xl font-bold text-gray-600">{sentimentCounts.Neutral}</div>
            <div className="text-xs text-muted-foreground">
              {total > 0 ? Math.round((sentimentCounts.Neutral / total) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <InsightCard stats={stats} reviews={allReviews} />

      <Tabs defaultValue="reviews">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <TabsList>
            <TabsTrigger value="reviews">
              <MessageSquare className="w-4 h-4 mr-2" />
              리뷰 ({reviewJobInfo?.totalReviews || allReviews.length})
            </TabsTrigger>
            <TabsTrigger value="aspects">
              <BarChart3 className="w-4 h-4 mr-2" />
              속성 분석
            </TabsTrigger>
            <TabsTrigger value="trends">
              <TrendingUp className="w-4 h-4 mr-2" />
              추이
            </TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            CSV 내보내기
          </Button>
        </div>

        <TabsContent value="reviews" className="mt-0 space-y-4">
          <Card className="p-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="리뷰 내용, 키워드, 작성자 검색..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  className="pl-9"
                />
              </div>
              <Select value={sentimentFilter} onValueChange={(v) => { setSentimentFilter(v as SentimentFilter); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-32">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="감정" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="Positive">긍정</SelectItem>
                  <SelectItem value="Negative">부정</SelectItem>
                  <SelectItem value="Neutral">중립</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
                <SelectTrigger className="w-full sm:w-36">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="정렬" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">최신순</SelectItem>
                  <SelectItem value="date-asc">오래된순</SelectItem>
                  <SelectItem value="sentiment">부정 우선</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {paginatedReviews.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>조건에 맞는 리뷰가 없습니다</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {paginatedReviews.map((review) => (
                <Card key={review.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {review.authorName && (
                          <span className="text-sm font-medium">{review.authorName}</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(review.reviewDate).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                      <SentimentBadge sentiment={review.sentiment} />
                    </div>
                    <p className="text-sm mb-3">{review.reviewText}</p>
                    {review.summary && (
                      <p className="text-xs text-muted-foreground mb-2">요약: {review.summary}</p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {review.aspects.map((asp, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {asp.aspect}: {asp.sentiment === "Positive" ? "+" : asp.sentiment === "Negative" ? "-" : "○"}
                        </Badge>
                      ))}
                      {review.keywords.map((kw, i) => (
                        <Badge key={`kw-${i}`} variant="secondary" className="text-xs">
                          #{kw}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <Card className="p-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>페이지당</span>
                  <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(parseInt(v)); setPage(1); }}>
                    <SelectTrigger className="w-16 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <span>/ 총 {filteredReviews.length}건</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={page}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val >= 1 && val <= totalPages) setPage(val);
                      }}
                      className="w-14 h-8 text-center"
                    />
                    <span className="text-sm text-muted-foreground">/ {totalPages}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="aspects" className="mt-0 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">속성별 감정 분포</CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.aspectStats.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">속성 데이터가 없습니다</p>
                ) : (
                  <div className="space-y-4">
                    {stats?.aspectStats.map((asp) => (
                      <div key={asp.aspect} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{asp.aspect}</span>
                          <span className="text-muted-foreground">{asp.total}건</span>
                        </div>
                        <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                          {asp.Positive > 0 && (
                            <div
                              className="bg-green-500"
                              style={{ width: `${(asp.Positive / asp.total) * 100}%` }}
                            />
                          )}
                          {asp.Neutral > 0 && (
                            <div
                              className="bg-gray-400"
                              style={{ width: `${(asp.Neutral / asp.total) * 100}%` }}
                            />
                          )}
                          {asp.Negative > 0 && (
                            <div
                              className="bg-red-500"
                              style={{ width: `${(asp.Negative / asp.total) * 100}%` }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <KeywordSentimentChart stats={stats} reviews={allReviews} />
          </div>
        </TabsContent>

        <TabsContent value="trends" className="mt-0 space-y-4">
          <SentimentTrendChart reviews={allReviews} />
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">키워드 빈도</CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.topKeywords.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">키워드 데이터가 없습니다</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {stats?.topKeywords.map((kw) => (
                    <Badge key={kw.keyword} variant="outline" className="px-3 py-1">
                      {kw.keyword}
                      <span className="ml-2 text-muted-foreground">{kw.count}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function PlaceReviewPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const { data: jobsData, isLoading, refetch } = useQuery<{ jobs: PlaceReviewJob[] }>({
    queryKey: ["place-review-jobs"],
    queryFn: async () => {
      const res = await fetch("/api/place-review/jobs", { credentials: "include" });
      if (!res.ok) throw new Error("작업 목록 조회 실패");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const retryMutation = useMutation({
    mutationFn: async (job: PlaceReviewJob) => {
      const body: any = { placeId: job.placeId, mode: job.mode };
      const res = await fetch("/api/place-review/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!res.ok) throw new Error("재시도 실패");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "재시도 시작", description: `새 작업 ID: ${data.jobId}` });
      queryClient.invalidateQueries({ queryKey: ["place-review-jobs"] });
      setSelectedJobId(data.jobId);
    },
    onError: () => {
      toast({ title: "재시도 실패", variant: "destructive" });
    },
  });

  const jobs = jobsData?.jobs || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
        <div className="space-y-6 md:space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">플레이스 리뷰 분석</h1>
                <p className="text-sm text-muted-foreground">네이버 플레이스 리뷰를 수집하고 AI로 감정을 분석합니다</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              새로고침
            </Button>
          </div>

          <ServiceStatusAlert service="redis" featureName="플레이스 리뷰 분석" />

          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-6">
              <CreateJobForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ["place-review-jobs"] })} />
              
              <div>
                <h2 className="text-lg font-semibold mb-3">분석 작업 목록</h2>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <JobList
                    jobs={jobs}
                    onSelect={setSelectedJobId}
                    selectedJobId={selectedJobId}
                    onRetry={(job) => retryMutation.mutate(job)}
                  />
                )}
              </div>
            </div>

            <div className="lg:col-span-2">
              {selectedJobId ? (
                <JobResults jobId={selectedJobId} />
              ) : (
                <Card>
                  <CardContent className="py-16 text-center text-muted-foreground">
                    <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium mb-1">분석 결과가 여기에 표시됩니다</p>
                    <p className="text-sm">왼쪽에서 분석 작업을 선택하거나 새 분석을 시작하세요</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
