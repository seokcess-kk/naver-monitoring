import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Shield, Home, RefreshCw, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  StatsCards,
  UsersTab,
  SearchLogsTab,
  AuditLogsTab,
  ApiKeysTab,
  SystemApiKeysTab,
  SolutionsTab,
  InsightsTab,
  ApiUsageTab,
  DataQualityTab,
  SystemStatusTab,
  FeedbackTab,
  PopupsTab,
  AdminSidebar,
  DEFAULT_TAB,
  type AdminStats,
} from "./admin/index";

export default function AdminPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const { data: stats, refetch: refetchStats, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["/api/admin/stats/overview"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/stats/overview");
      return res.json() as Promise<AdminStats>;
    },
    enabled: isAuthenticated && (user?.role === "admin" || user?.role === "superadmin"),
  });

  useEffect(() => {
    if (dataUpdatedAt) {
      setLastUpdated(new Date(dataUpdatedAt));
    }
  }, [dataUpdatedAt]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/auth" />;
  }

  if (user?.role !== "admin" && user?.role !== "superadmin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-semibold mb-2">접근 권한 없음</h2>
            <p className="text-muted-foreground mb-4">관리자 권한이 필요한 페이지입니다.</p>
            <Button variant="outline" onClick={() => window.location.href = "/"}>
              <Home className="w-4 h-4 mr-2" />
              홈으로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatLastUpdated = (date: Date) => {
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.location.href = "/"} title="홈으로">
              <Home className="w-4 h-4" />
            </Button>
            <h1 className="text-base font-semibold">Admin Console</h1>
            <Badge variant="secondary" className="text-xs font-normal hidden sm:inline-flex">
              {user?.role === "superadmin" ? "슈퍼 관리자" : "관리자"}
            </Badge>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatLastUpdated(lastUpdated)}</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetchStats()}
              disabled={isFetching}
              className="h-8"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline ml-1.5">새로고침</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col lg:flex-row">
          <div className="p-4 lg:p-0">
            <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
          </div>

          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            <div className="space-y-6">
              <StatsCards stats={stats} />

              <TabsContent value="users" className="mt-0"><UsersTab /></TabsContent>
              <TabsContent value="logs" className="mt-0"><SearchLogsTab /></TabsContent>
              <TabsContent value="audit" className="mt-0"><AuditLogsTab /></TabsContent>
              <TabsContent value="system-apikeys" className="mt-0"><SystemApiKeysTab /></TabsContent>
              <TabsContent value="apikeys" className="mt-0"><ApiKeysTab /></TabsContent>
              <TabsContent value="solutions" className="mt-0"><SolutionsTab /></TabsContent>
              <TabsContent value="insights" className="mt-0"><InsightsTab /></TabsContent>
              <TabsContent value="api-usage" className="mt-0"><ApiUsageTab /></TabsContent>
              <TabsContent value="data-quality" className="mt-0"><DataQualityTab /></TabsContent>
              <TabsContent value="system" className="mt-0"><SystemStatusTab /></TabsContent>
              <TabsContent value="feedback" className="mt-0"><FeedbackTab /></TabsContent>
              <TabsContent value="popups" className="mt-0"><PopupsTab /></TabsContent>
            </div>
          </main>
        </Tabs>
      </div>
    </div>
  );
}
