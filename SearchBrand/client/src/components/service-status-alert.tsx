import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuickStatus {
  redis: boolean;
  chrome: boolean;
}

interface ServiceStatusAlertProps {
  service: "redis" | "chrome";
  featureName: string;
}

const serviceMessages: Record<string, { title: string; description: string }> = {
  redis: {
    title: "리뷰 분석 서비스 점검 중",
    description: "현재 플레이스 리뷰 분석 서비스를 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  },
  chrome: {
    title: "스마트블록 크롤링 서비스 점검 중",
    description: "현재 스마트블록 크롤링 서비스를 이용할 수 없습니다. 기본 검색 결과만 표시됩니다.",
  },
};

export function ServiceStatusAlert({ service, featureName }: ServiceStatusAlertProps) {
  const { data: status, isLoading, isError, refetch } = useQuery<QuickStatus>({
    queryKey: ["services-quick-status"],
    queryFn: async () => {
      const res = await fetch("/api/services/quick-status");
      if (!res.ok) throw new Error("Failed to fetch service status");
      return res.json();
    },
    staleTime: 30000,
    refetchInterval: 60000,
    retry: 2,
  });

  if (isLoading) return null;

  if (isError) {
    return (
      <Alert variant="default" className="mb-4 border-amber-500/50 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertTitle className="flex items-center gap-2">
          서비스 상태 확인 불가
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-2"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </AlertTitle>
        <AlertDescription>서비스 상태를 확인할 수 없습니다. {featureName} 기능이 정상 작동하지 않을 수 있습니다.</AlertDescription>
      </Alert>
    );
  }

  const isAvailable = status?.[service] ?? true;
  
  if (isAvailable) return null;

  const message = serviceMessages[service];

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        {message.title}
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 px-2"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </AlertTitle>
      <AlertDescription>{message.description}</AlertDescription>
    </Alert>
  );
}

export function useServiceStatus() {
  const { data: status, isLoading, isError } = useQuery<QuickStatus>({
    queryKey: ["services-quick-status"],
    queryFn: async () => {
      const res = await fetch("/api/services/quick-status");
      if (!res.ok) throw new Error("Failed to fetch service status");
      return res.json();
    },
    staleTime: 30000,
    refetchInterval: 60000,
    retry: 2,
  });

  return {
    isLoading,
    isError,
    redisAvailable: isError ? null : (status?.redis ?? true),
    chromeAvailable: isError ? null : (status?.chrome ?? true),
  };
}
