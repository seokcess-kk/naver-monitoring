import { useState } from "react";
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
import { Loader2, Play, Trash2, BarChart3, MessageSquare, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";

interface PlaceReviewJob {
  id: string;
  placeId: string;
  placeName: string | null;
  mode: string;
  status: string;
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

function JobList({ jobs, onSelect, selectedJobId }: { jobs: PlaceReviewJob[]; onSelect: (id: string) => void; selectedJobId: string | null }) {
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
          아직 분석 작업이 없습니다. 새 분석을 시작하세요.
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
                <span className="font-medium">{job.placeId}</span>
                <StatusBadge status={job.status} />
              </div>
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
            {job.status === "processing" && (
              <Progress value={parseInt(job.progress)} className="h-2 mb-2" />
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
  const { data: statsData, isLoading: statsLoading } = useQuery<JobStats>({
    queryKey: ["place-review-stats", jobId],
    queryFn: async () => {
      const res = await fetch(`/api/place-review/jobs/${jobId}/stats`, { credentials: "include" });
      if (!res.ok) throw new Error("통계 조회 실패");
      return res.json();
    },
  });

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery<{ reviews: ReviewWithAnalysis[] }>({
    queryKey: ["place-review-reviews", jobId],
    queryFn: async () => {
      const res = await fetch(`/api/place-review/jobs/${jobId}/reviews`, { credentials: "include" });
      if (!res.ok) throw new Error("리뷰 조회 실패");
      return res.json();
    },
  });

  if (statsLoading || reviewsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const stats = statsData;
  const reviews = reviewsData?.reviews || [];

  const sentimentCounts = {
    Positive: stats?.sentimentStats.find((s) => s.sentiment === "Positive")?.count || 0,
    Negative: stats?.sentimentStats.find((s) => s.sentiment === "Negative")?.count || 0,
    Neutral: stats?.sentimentStats.find((s) => s.sentiment === "Neutral")?.count || 0,
  };

  const total = sentimentCounts.Positive + sentimentCounts.Negative + sentimentCounts.Neutral;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
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
        <Card>
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
        <Card>
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

      <Tabs defaultValue="reviews">
        <TabsList>
          <TabsTrigger value="reviews">
            <MessageSquare className="w-4 h-4 mr-2" />
            리뷰 ({reviews.length})
          </TabsTrigger>
          <TabsTrigger value="aspects">
            <BarChart3 className="w-4 h-4 mr-2" />
            속성 분석
          </TabsTrigger>
          <TabsTrigger value="keywords">
            키워드
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reviews" className="mt-4 space-y-3">
          {reviews.map((review) => (
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
        </TabsContent>

        <TabsContent value="aspects" className="mt-4">
          <Card>
            <CardContent className="p-4">
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
        </TabsContent>

        <TabsContent value="keywords" className="mt-4">
          <Card>
            <CardContent className="p-4">
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

  const jobs = jobsData?.jobs || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">플레이스 리뷰 분석</h1>
            <p className="text-muted-foreground">네이버 플레이스 리뷰를 수집하고 AI로 감정을 분석합니다</p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
        </div>

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
                  <p>왼쪽에서 분석 작업을 선택하거나 새 분석을 시작하세요</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
