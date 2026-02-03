import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Hash,
  Calendar,
  BarChart3,
} from "lucide-react";

interface ReportModalProps {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExecutiveSummary {
  overallSummary: string;
  positivePoints: string[];
  negativePoints: string[];
  recommendations: string[];
}

interface SentimentRatio {
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  positivePercent: number;
  negativePercent: number;
  neutralPercent: number;
}

interface KeywordItem {
  keyword: string;
  count: number;
}

interface SentimentKeywords {
  positive: KeywordItem[];
  negative: KeywordItem[];
  all: KeywordItem[];
}

interface MonthlyTrend {
  period: string;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

interface ReportData {
  job: {
    id: string;
    placeName: string | null;
    placeId: string;
    totalReviews: string | null;
    completedAt: string | null;
  };
  executiveSummary: ExecutiveSummary;
  sentimentRatio: SentimentRatio;
  sentimentKeywords: SentimentKeywords;
  monthlyTrend: MonthlyTrend[];
}

const COLORS = {
  positive: "#10b981",
  negative: "#ef4444",
  neutral: "#6b7280",
};

function SentimentPieChart({ data }: { data: SentimentRatio }) {
  const chartData = [
    { name: "긍정", value: data.positive, color: COLORS.positive },
    { name: "부정", value: data.negative, color: COLORS.negative },
    { name: "중립", value: data.neutral, color: COLORS.neutral },
  ].filter((d) => d.value > 0);

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`${value}건`, ""]}
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendChart({ data }: { data: MonthlyTrend[] }) {
  const formattedData = data.map((d) => ({
    ...d,
    period: d.period.slice(2).replace("-", "."),
  }));

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="positiveGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.positive} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.positive} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="negativeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.negative} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.negative} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="positive"
            name="긍정"
            stroke={COLORS.positive}
            fill="url(#positiveGradient)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="negative"
            name="부정"
            stroke={COLORS.negative}
            fill="url(#negativeGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function KeywordCloud({
  keywords,
  variant,
}: {
  keywords: KeywordItem[];
  variant: "positive" | "negative" | "all";
}) {
  const colorClass =
    variant === "positive"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
      : variant === "negative"
        ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
        : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";

  if (keywords.length === 0) {
    return <p className="text-sm text-muted-foreground">키워드가 없습니다</p>;
  }

  const maxCount = Math.max(...keywords.map((k) => k.count));

  return (
    <div className="flex flex-wrap gap-2">
      {keywords.map((kw, idx) => {
        const size = 0.8 + (kw.count / maxCount) * 0.4;
        return (
          <Badge
            key={idx}
            variant="outline"
            className={`${colorClass} transition-transform hover:scale-105`}
            style={{ fontSize: `${size}rem` }}
          >
            {kw.keyword}
            <span className="ml-1 opacity-60">{kw.count}</span>
          </Badge>
        );
      })}
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function PlaceReviewReportModal({ jobId, open, onOpenChange }: ReportModalProps) {
  const { data: report, isLoading, isError, error } = useQuery<ReportData>({
    queryKey: ["/api/place-review/jobs", jobId, "report"],
    queryFn: async () => {
      const res = await fetch(`/api/place-review/jobs/${jobId}/report`, {
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "리포트 조회 실패");
      }
      return res.json();
    },
    enabled: !!jobId && open,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            리뷰 분석 리포트
            {report?.job?.placeName && (
              <Badge variant="secondary" className="ml-2">
                {report.job.placeName}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <ReportSkeleton />
        ) : report ? (
          <div className="space-y-6">
            <Card className="border-border/50 bg-gradient-to-r from-blue-500/5 to-violet-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-foreground leading-relaxed">
                  {report.executiveSummary.overallSummary}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <ThumbsUp className="w-8 h-8 text-emerald-500" />
                    <div>
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {report.sentimentRatio.positivePercent}%
                      </p>
                      <p className="text-xs text-muted-foreground">긍정</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <ThumbsDown className="w-8 h-8 text-red-500" />
                    <div>
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {report.sentimentRatio.negativePercent}%
                      </p>
                      <p className="text-xs text-muted-foreground">부정</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-500/10 border border-gray-500/20">
                    <Minus className="w-8 h-8 text-gray-500" />
                    <div>
                      <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                        {report.sentimentRatio.neutralPercent}%
                      </p>
                      <p className="text-xs text-muted-foreground">중립</p>
                    </div>
                  </div>
                </div>

                {report.executiveSummary.positivePoints.length > 0 && (
                  <div className="pt-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-2 text-emerald-600 dark:text-emerald-400">
                      <TrendingUp className="w-4 h-4" />
                      긍정 포인트
                    </h4>
                    <ul className="space-y-1">
                      {report.executiveSummary.positivePoints.map((point, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-emerald-500 mt-1">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.executiveSummary.negativePoints.length > 0 && (
                  <div className="pt-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-2 text-red-600 dark:text-red-400">
                      <TrendingDown className="w-4 h-4" />
                      개선 필요 포인트
                    </h4>
                    <ul className="space-y-1">
                      {report.executiveSummary.negativePoints.map((point, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-red-500 mt-1">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.executiveSummary.recommendations.length > 0 && (
                  <div className="pt-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-400">
                      <Lightbulb className="w-4 h-4" />
                      개선 제안
                    </h4>
                    <ul className="space-y-1">
                      {report.executiveSummary.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-amber-500 mt-1">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Hash className="w-4 h-4 text-emerald-500" />
                    긍정 키워드 Top 10
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <KeywordCloud keywords={report.sentimentKeywords.positive} variant="positive" />
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Hash className="w-4 h-4 text-red-500" />
                    부정 키워드 Top 10
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <KeywordCloud keywords={report.sentimentKeywords.negative} variant="negative" />
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Hash className="w-4 h-4 text-blue-500" />
                  전체 키워드 Top 15
                </CardTitle>
              </CardHeader>
              <CardContent>
                <KeywordCloud keywords={report.sentimentKeywords.all} variant="all" />
              </CardContent>
            </Card>

            {report.monthlyTrend.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-violet-500" />
                    월별 감정 추이
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TrendChart data={report.monthlyTrend} />
                </CardContent>
              </Card>
            )}

            <div className="text-xs text-muted-foreground text-center pt-2">
              총 {report.sentimentRatio.total}개 리뷰 분석 완료
              {report.job.completedAt && (
                <span className="ml-2">
                  • {new Date(report.job.completedAt).toLocaleDateString("ko-KR")} 분석
                </span>
              )}
            </div>
          </div>
        ) : isError ? (
          <div className="text-center py-8">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-destructive opacity-60" />
            <p className="text-destructive font-medium mb-1">리포트 생성 실패</p>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다"}
            </p>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            리포트를 불러올 수 없습니다
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
