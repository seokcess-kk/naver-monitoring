import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { LineChart, TrendingUp } from "lucide-react";

interface TrendDataPoint {
  period: string;
  ratio: number;
}

interface KeywordTrendChartProps {
  trend: TrendDataPoint[] | null;
  totalVolume: number;
  keyword: string;
  isLoading: boolean;
}

function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  return `${year.slice(2)}.${month}`;
}

function estimateVolume(ratio: number, lastRatio: number, totalVolume: number): number {
  if (lastRatio <= 0) return 0;
  return Math.round((ratio / lastRatio) * totalVolume);
}

export function KeywordTrendChart({ trend, totalVolume, keyword, isLoading }: KeywordTrendChartProps) {
  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <Skeleton className="h-52" />
        </CardContent>
      </Card>
    );
  }

  if (!trend || trend.length === 0) {
    return null;
  }

  const lastRatio = trend[trend.length - 1]?.ratio || 1;

  const chartData = trend.map((point) => ({
    period: formatPeriod(point.period),
    fullPeriod: point.period,
    ratio: point.ratio,
    volume: estimateVolume(point.ratio, lastRatio, totalVolume),
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">{data.fullPeriod}</p>
          <p className="text-sm font-semibold text-foreground">
            약 {data.volume.toLocaleString()}회
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">월별 검색량 트렌드</CardTitle>
            <p className="text-xs text-muted-foreground">
              '{keyword}' 키워드의 최근 {trend.length}개월 추이
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 pb-4">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                opacity={0.5}
              />
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
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                  return value.toString();
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="linear"
                dataKey="volume"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#volumeGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
