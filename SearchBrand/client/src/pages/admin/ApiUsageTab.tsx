import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Zap, Search, MessageSquare, AlertTriangle, ShieldCheck, ShieldAlert, ShieldX, ChevronDown, ChevronUp } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { apiRequest } from "@/lib/queryClient";
import { API_TYPE_LABELS, API_TYPE_COLORS, type ApiUsageStats } from "./types";

interface QuotaItem {
  clientId: string;
  email: string;
  used: number;
  limit: number;
  remaining: number;
  percentageUsed: number;
  status: "ok" | "warning" | "critical" | "exceeded";
}

interface QuotaResponse {
  quotas: QuotaItem[];
  summary: {
    totalClientIds: number;
    warningCount: number;
    criticalCount: number;
    exceededCount: number;
  };
}

type FeatureRankings = {
  search?: Array<{ userId: string; email: string; count: number }>;
  placeReview?: Array<{ userId: string; email: string; count: number }>;
};

const FEATURE_LABELS: Record<string, string> = {
  search: "통합검색",
  placeReview: "플레이스 리뷰",
};

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  search: <Search className="w-4 h-4" />,
  placeReview: <MessageSquare className="w-4 h-4" />,
};

export function ApiUsageTab() {
  const [dateRange, setDateRange] = useState<string>("7days");
  const [selectedFeature, setSelectedFeature] = useState<string>("search");
  const [quotaExpanded, setQuotaExpanded] = useState(false);
  
  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    switch (dateRange) {
      case "today": start.setHours(0,0,0,0); break;
      case "7days": start.setDate(start.getDate() - 7); break;
      case "30days": start.setDate(start.getDate() - 30); break;
      default: start.setDate(start.getDate() - 7);
    }
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  };
  
  const { startDate, endDate } = getDateRange();
  
  const { data: stats, isLoading } = useQuery<ApiUsageStats>({
    queryKey: ["admin-api-usage-stats", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await apiRequest("GET", `/api/admin/api-usage/stats?${params}`);
      return res.json();
    },
  });
  
  const { data: featureRankings } = useQuery<FeatureRankings>({
    queryKey: ["admin-feature-rankings", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await apiRequest("GET", `/api/admin/api-usage/feature-rankings?${params}`);
      return res.json();
    },
  });
  
  const { data: quotaData } = useQuery<QuotaResponse>({
    queryKey: ["admin-quota-status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/api-usage/quota");
      return res.json();
    },
    refetchInterval: 60000,
  });
  
  const chartData = useMemo(() => {
    if (!stats?.dailyTrend) return [];
    const grouped: Record<string, Record<string, number>> = {};
    stats.dailyTrend.forEach(d => {
      if (!grouped[d.date]) grouped[d.date] = {};
      grouped[d.date][d.apiType] = d.count;
    });
    return Object.entries(grouped)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, counts]) => ({
        date: new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
        ...counts,
      }));
  }, [stats?.dailyTrend]);
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Zap className="w-5 h-5" />
          API 사용량 모니터링
        </h2>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">오늘</SelectItem>
            <SelectItem value="7days">최근 7일</SelectItem>
            <SelectItem value="30days">최근 30일</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex flex-wrap gap-3">
        {stats?.byApiType.map(api => (
          <div key={api.apiType} className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
            <div 
              className="w-2.5 h-2.5 rounded-full" 
              style={{ backgroundColor: API_TYPE_COLORS[api.apiType] || "#888" }}
            />
            <span className="text-sm font-medium">
              {API_TYPE_LABELS[api.apiType] || api.apiType}
            </span>
            <span className="text-lg font-bold">{api.totalCalls.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">({api.successRate}%)</span>
          </div>
        ))}
      </div>
      
      {quotaData && quotaData.quotas.length > 0 && (
        <Collapsible open={quotaExpanded} onOpenChange={setQuotaExpanded}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    사용자별 API 한도
                    {quotaExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </span>
                  <div className="flex items-center gap-2 text-sm font-normal">
                    {quotaData.summary.exceededCount > 0 && (
                      <Badge variant="destructive" className="text-xs">초과 {quotaData.summary.exceededCount}</Badge>
                    )}
                    {quotaData.summary.criticalCount > 0 && (
                      <Badge variant="destructive" className="text-xs">위험 {quotaData.summary.criticalCount}</Badge>
                    )}
                    {quotaData.summary.warningCount > 0 && (
                      <Badge variant="secondary" className="text-xs">경고 {quotaData.summary.warningCount}</Badge>
                    )}
                    <Badge variant="outline" className="text-xs">총 {quotaData.summary.totalClientIds}개</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client ID</TableHead>
                      <TableHead>사용자</TableHead>
                      <TableHead className="text-right">사용량</TableHead>
                      <TableHead className="w-40">진행률</TableHead>
                      <TableHead className="text-right">상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotaData.quotas.map((quota) => (
                      <TableRow key={quota.clientId}>
                        <TableCell className="font-mono text-xs">
                          {quota.clientId.substring(0, 8)}...
                        </TableCell>
                        <TableCell>{quota.email}</TableCell>
                        <TableCell className="text-right">
                          {quota.used.toLocaleString()} / {quota.limit.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Progress 
                            value={Math.min(quota.percentageUsed, 100)} 
                            className={`h-2 ${
                              quota.status === "exceeded" || quota.status === "critical" 
                                ? "[&>div]:bg-destructive" 
                                : quota.status === "warning" 
                                ? "[&>div]:bg-yellow-500" 
                                : ""
                            }`}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge 
                            variant={
                              quota.status === "exceeded" || quota.status === "critical" 
                                ? "destructive" 
                                : quota.status === "warning" 
                                ? "secondary" 
                                : "outline"
                            }
                            className="text-xs"
                          >
                            {quota.percentageUsed.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">일별 API 호출 추이</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {stats?.byApiType.map(api => (
                  <Area 
                    key={api.apiType}
                    type="monotone" 
                    dataKey={api.apiType} 
                    name={API_TYPE_LABELS[api.apiType] || api.apiType} 
                    stackId="1" 
                    stroke={API_TYPE_COLORS[api.apiType] || "#888"} 
                    fill={API_TYPE_COLORS[api.apiType] || "#888"} 
                    fillOpacity={0.6} 
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              데이터가 없습니다
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">기능별 사용자 순위</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={selectedFeature} onValueChange={setSelectedFeature}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="search" className="flex items-center gap-2">
                {FEATURE_ICONS.search}
                <span className="hidden sm:inline">{FEATURE_LABELS.search}</span>
              </TabsTrigger>
              <TabsTrigger value="placeReview" className="flex items-center gap-2">
                {FEATURE_ICONS.placeReview}
                <span className="hidden sm:inline">{FEATURE_LABELS.placeReview}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">순위</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead className="text-right">사용 횟수</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(featureRankings?.[selectedFeature as keyof FeatureRankings] || []).map((user, idx) => (
                <TableRow key={user.userId || idx}>
                  <TableCell className="font-medium">{idx + 1}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell className="text-right">{user.count.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {(!featureRankings?.[selectedFeature as keyof FeatureRankings] || 
                featureRankings[selectedFeature as keyof FeatureRankings]?.length === 0) && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    {FEATURE_LABELS[selectedFeature]} 사용 데이터가 없습니다
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
