import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Server, RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { AllServicesStatus } from "./types";

export function SystemStatusTab() {
  const { data: status, isLoading, refetch, isFetching } = useQuery<AllServicesStatus>({
    queryKey: ["admin-services-status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/services/status");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ok":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ok":
        return <Badge className="bg-green-500">정상</Badge>;
      case "error":
        return <Badge variant="destructive">오류</Badge>;
      default:
        return <Badge variant="secondary">알 수 없음</Badge>;
    }
  };

  const getOverallStatusBadge = (status: string) => {
    switch (status) {
      case "ok":
        return <Badge className="bg-green-500 text-lg px-4 py-1">모든 서비스 정상</Badge>;
      case "degraded":
        return <Badge variant="secondary" className="bg-amber-500 text-lg px-4 py-1">일부 서비스 오류</Badge>;
      case "error":
        return <Badge variant="destructive" className="text-lg px-4 py-1">시스템 오류</Badge>;
      default:
        return <Badge variant="secondary" className="text-lg px-4 py-1">확인 중</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-8">
            <div className="flex justify-center">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const services = status ? [
    { key: "database", ...status.database },
    { key: "redis", ...status.redis },
    { key: "chrome", ...status.chrome },
    { key: "openai", ...status.openai },
  ] : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                시스템 상태
              </CardTitle>
              <CardDescription>
                마지막 확인: {status ? new Date(status.checkedAt).toLocaleString("ko-KR") : "-"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              {status && getOverallStatusBadge(status.overallStatus)}
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
                새로고침
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>서비스</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>메시지</TableHead>
                <TableHead>영향받는 기능</TableHead>
                <TableHead>확인 시간</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.key}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(service.status)}
                      {service.name}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(service.status)}</TableCell>
                  <TableCell className="text-sm">{service.message}</TableCell>
                  <TableCell>
                    {service.affectedFeatures.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {service.affectedFeatures.map((feature, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">{feature}</Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(service.checkedAt).toLocaleTimeString("ko-KR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>서비스 설명</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">PostgreSQL (필수)</h4>
              <p className="text-sm text-muted-foreground">데이터베이스 서비스. 이 서비스가 중단되면 전체 앱이 작동하지 않습니다.</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">Redis (선택)</h4>
              <p className="text-sm text-muted-foreground">백그라운드 작업 큐 서비스. 중단 시 플레이스 리뷰 분석 기능이 비활성화됩니다.</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">Chrome/Puppeteer (선택)</h4>
              <p className="text-sm text-muted-foreground">웹 크롤링 서비스. 중단 시 스마트블록 크롤링 기능이 비활성화됩니다.</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">OpenAI (선택)</h4>
              <p className="text-sm text-muted-foreground">AI 분석 서비스. 중단 시 SOV 분석 기능이 비활성화됩니다.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
