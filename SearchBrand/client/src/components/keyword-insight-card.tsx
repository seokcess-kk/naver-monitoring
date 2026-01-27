import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Monitor,
  Smartphone,
  BarChart3,
} from "lucide-react";

interface TrendDataPoint {
  period: string;
  ratio: number;
}

interface KeywordInsight {
  keyword: string;
  totalVolume: number;
  pcVolume: number;
  mobileVolume: number;
  compIdx: string;
  momGrowth: number | null;
  yoyGrowth: number | null;
  trend: TrendDataPoint[] | null;
}

interface KeywordInsightCardProps {
  insight: KeywordInsight | null;
  isLoading: boolean;
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function getGrowthIcon(growth: number | null) {
  if (growth === null) return <Minus className="w-3 h-3" />;
  if (growth > 0) return <TrendingUp className="w-3 h-3 text-emerald-500" />;
  if (growth < 0) return <TrendingDown className="w-3 h-3 text-red-500" />;
  return <Minus className="w-3 h-3 text-muted-foreground" />;
}

function getGrowthColor(growth: number | null): string {
  if (growth === null) return "text-muted-foreground";
  if (growth > 0) return "text-emerald-600 dark:text-emerald-400";
  if (growth < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

function getCompIdxColor(compIdx: string): string {
  switch (compIdx) {
    case "높음":
      return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    case "중간":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "낮음":
    default:
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  }
}

export function KeywordInsightCard({ insight, isLoading }: KeywordInsightCardProps) {
  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!insight) {
    return null;
  }

  const pcRatio = insight.totalVolume > 0 
    ? Math.round((insight.pcVolume / insight.totalVolume) * 100) 
    : 0;
  const mobileRatio = 100 - pcRatio;

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-500/5 to-violet-500/5 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">키워드 인사이트</CardTitle>
              <p className="text-xs text-muted-foreground">월간 검색량 및 트렌드 분석</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">총 검색량</span>
            </div>
            <div className="text-xl font-bold text-foreground">
              {formatNumber(insight.totalVolume)}
            </div>
            <div className="text-[10px] text-muted-foreground">월간 (30일)</div>
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <Monitor className="w-3.5 h-3.5 text-blue-500" />
              <Smartphone className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-xs text-muted-foreground">디바이스</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                PC {pcRatio}%
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">
                MO {mobileRatio}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden flex">
              <div 
                className="h-full bg-blue-500/70" 
                style={{ width: `${pcRatio}%` }}
              />
              <div 
                className="h-full bg-violet-500/70" 
                style={{ width: `${mobileRatio}%` }}
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              {getGrowthIcon(insight.momGrowth)}
              <span className="text-xs text-muted-foreground">전월 대비</span>
            </div>
            <div className={`text-xl font-bold ${getGrowthColor(insight.momGrowth)}`}>
              {insight.momGrowth !== null 
                ? `${insight.momGrowth > 0 ? '+' : ''}${insight.momGrowth.toFixed(1)}%` 
                : '-'}
            </div>
            <div className="text-[10px] text-muted-foreground">MoM</div>
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              {getGrowthIcon(insight.yoyGrowth)}
              <span className="text-xs text-muted-foreground">전년 대비</span>
            </div>
            <div className={`text-xl font-bold ${getGrowthColor(insight.yoyGrowth)}`}>
              {insight.yoyGrowth !== null 
                ? `${insight.yoyGrowth > 0 ? '+' : ''}${insight.yoyGrowth.toFixed(1)}%` 
                : '-'}
            </div>
            <div className="text-[10px] text-muted-foreground">YoY</div>
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">경쟁도</span>
            </div>
            <div className="mt-1">
              <Badge 
                variant="outline" 
                className={`text-sm font-semibold ${getCompIdxColor(insight.compIdx)}`}
              >
                {insight.compIdx}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
