import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { SovPanel } from "@/components/sov-panel";
import { ApiKeySetup } from "@/components/api-key-setup";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, AlertCircle } from "lucide-react";
import type { ApiKeyPublic } from "@shared/schema";
import { useState, useEffect } from "react";

export default function SovAnalysisPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [apiKeySetupOpen, setApiKeySetupOpen] = useState<boolean | undefined>(undefined);

  const { data: apiKey, isLoading: apiKeyLoading, refetch: refetchApiKey } = useQuery<ApiKeyPublic>({
    queryKey: ["/api/api-keys"],
    enabled: !!user,
  });

  const hasApiKey = !!apiKey?.hasClientSecret;

  useEffect(() => {
    if (!apiKeyLoading && apiKeySetupOpen === undefined) {
      setApiKeySetupOpen(!hasApiKey);
    }
  }, [apiKeyLoading, hasApiKey, apiKeySetupOpen]);

  if (authLoading || apiKeyLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
          <div className="space-y-4 md:space-y-6">
            <Skeleton className="h-12 w-48 rounded-xl" />
            <Skeleton className="h-32 md:h-40 w-full rounded-xl" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
        <div className="space-y-6 md:space-y-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">SOV 분석</h1>
              <p className="text-sm text-muted-foreground">Share of Voice - 브랜드 노출 점유율 분석</p>
            </div>
          </div>

          <ApiKeySetup 
            existingApiKey={apiKey} 
            onSave={() => refetchApiKey()}
            isOpen={apiKeySetupOpen}
            onOpenChange={setApiKeySetupOpen}
          />

          {!hasApiKey ? (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="py-8">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="p-3 rounded-full bg-amber-500/10">
                    <AlertCircle className="w-8 h-8 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1">API 키 설정 필요</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      SOV 분석을 사용하려면 먼저 네이버 API 키를 등록해주세요.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <SovPanel />
          )}
        </div>
      </main>
    </div>
  );
}
