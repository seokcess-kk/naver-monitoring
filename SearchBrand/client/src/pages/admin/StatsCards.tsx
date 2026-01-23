import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Activity, Search, Key } from "lucide-react";
import type { AdminStats } from "./types";

interface StatsCardsProps {
  stats: AdminStats | undefined;
}

export function StatsCards({ stats }: StatsCardsProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">사용자</span>
          </div>
          <p className="text-2xl font-bold">{stats.users.total}</p>
          <p className="text-xs text-muted-foreground">
            활성 {stats.users.active} / 정지 {stats.users.suspended}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-green-500" />
            <span className="text-sm text-muted-foreground">SOV 분석</span>
          </div>
          <p className="text-2xl font-bold">{stats.sovRuns.total}</p>
          <p className="text-xs text-muted-foreground">
            완료 {stats.sovRuns.completed} / 실패 {stats.sovRuns.failed}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-muted-foreground">검색 로그</span>
          </div>
          <p className="text-2xl font-bold">{stats.searchLogs.total}</p>
          <p className="text-xs text-muted-foreground">
            통합 {stats.searchLogs.unified} / SOV {stats.searchLogs.sov}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-4 h-4 text-orange-500" />
            <span className="text-sm text-muted-foreground">API 키</span>
          </div>
          <p className="text-2xl font-bold">{stats.apiKeys.total}</p>
          <p className="text-xs text-muted-foreground">등록된 키</p>
        </CardContent>
      </Card>
    </div>
  );
}
