import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { apiRequest } from "@/lib/queryClient";
import { API_TYPE_LABELS, API_TYPE_COLORS, type ApiUsageStats } from "./types";

export function ApiUsageTab() {
  const [dateRange, setDateRange] = useState<string>("7days");
  
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
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats?.byApiType.map(api => (
          <Card key={api.apiType}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: API_TYPE_COLORS[api.apiType] || "#888" }}
                />
                <span className="text-sm text-muted-foreground">
                  {API_TYPE_LABELS[api.apiType] || api.apiType}
                </span>
              </div>
              <p className="text-2xl font-bold">{api.totalCalls.toLocaleString()}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="text-green-600">성공 {api.successRate}%</span>
                {api.totalTokens > 0 && (
                  <span>| 토큰 {api.totalTokens.toLocaleString()}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                평균 응답 {api.avgResponseTime}ms
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      
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
                <Area type="monotone" dataKey="naver_search" name="네이버 검색" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} />
                <Area type="monotone" dataKey="naver_ad" name="네이버 광고" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                <Area type="monotone" dataKey="openai" name="OpenAI" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                <Area type="monotone" dataKey="browserless" name="Browserless" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} />
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
          <CardTitle className="text-base">사용자별 API 사용량 순위</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>순위</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead className="text-right">호출 횟수</TableHead>
                <TableHead className="text-right">토큰 사용량</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats?.topUsers.map((user, idx) => (
                <TableRow key={user.userId || idx}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell className="text-right">{user.totalCalls.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{user.totalTokens.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {(!stats?.topUsers || stats.topUsers.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    데이터가 없습니다
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
