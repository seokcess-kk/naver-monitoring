import { useQuery } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, ArrowLeft, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  StatsCards,
  UsersTab,
  SovRunsTab,
  SearchLogsTab,
  AuditLogsTab,
  ApiKeysTab,
  SolutionsTab,
  InsightsTab,
  ApiUsageTab,
  DataQualityTab,
  SystemStatusTab,
  TAB_GROUPS,
  DEFAULT_TAB,
  type AdminStats,
} from "./admin/index";

export default function AdminPage() {
  const { user, isLoading, isAuthenticated } = useAuth();

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["/api/admin/stats/overview"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/stats/overview");
      return res.json() as Promise<AdminStats>;
    },
    enabled: isAuthenticated && (user?.role === "admin" || user?.role === "superadmin"),
  });

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
              <ArrowLeft className="w-4 h-4 mr-2" />
              홈으로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => window.location.href = "/"}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              대시보드
            </Button>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-xl font-bold">Admin Console</h1>
            <Badge variant={user?.role === "superadmin" ? "destructive" : "default"}>
              {user?.role === "superadmin" ? "슈퍼 관리자" : "관리자"}
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchStats()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <StatsCards stats={stats} />

        <Tabs defaultValue={DEFAULT_TAB} className="space-y-4">
          <div className="flex flex-wrap gap-6 border-b pb-4">
            {TAB_GROUPS.map((group) => (
              <div key={group.id} className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </span>
                <TabsList className="grid" style={{ gridTemplateColumns: `repeat(${group.tabs.length}, minmax(0, 1fr))` }}>
                  {group.tabs.map((tab) => {
                    const IconComponent = tab.icon;
                    return (
                      <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                        <IconComponent className="w-4 h-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>
            ))}
          </div>

          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="sov"><SovRunsTab /></TabsContent>
          <TabsContent value="logs"><SearchLogsTab /></TabsContent>
          <TabsContent value="audit"><AuditLogsTab /></TabsContent>
          <TabsContent value="apikeys"><ApiKeysTab /></TabsContent>
          <TabsContent value="solutions"><SolutionsTab /></TabsContent>
          <TabsContent value="insights"><InsightsTab /></TabsContent>
          <TabsContent value="api-usage"><ApiUsageTab /></TabsContent>
          <TabsContent value="data-quality"><DataQualityTab /></TabsContent>
          <TabsContent value="system"><SystemStatusTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
