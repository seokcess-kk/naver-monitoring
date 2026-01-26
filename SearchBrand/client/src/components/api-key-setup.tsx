import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Key,
  ChevronDown,
  Check,
  Loader2,
  Eye,
  EyeOff,
  Shield,
  ExternalLink,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { ApiKeyPublic } from "@shared/schema";

interface ApiKeySetupProps {
  existingApiKey: ApiKeyPublic | undefined;
  onSave: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ApiKeySetup({
  existingApiKey,
  onSave,
  isOpen: controlledOpen,
  onOpenChange,
}: ApiKeySetupProps) {
  const hasExistingKey = !!existingApiKey?.hasClientSecret;
  const [internalOpen, setInternalOpen] = useState(!hasExistingKey);

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalOpen(open);
    }
  };
  const [clientId, setClientId] = useState(existingApiKey?.clientId || "");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async (data: { clientId: string; clientSecret: string }) => {
      if (hasExistingKey) {
        return apiRequest("PUT", "/api/api-keys", data);
      }
      return apiRequest("POST", "/api/api-keys", data);
    },
    onSuccess: () => {
      toast({
        title: "저장 완료",
        description: "API 키가 성공적으로 저장되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      onSave();
      setIsOpen(false);
    },
    onError: () => {
      toast({
        title: "저장 실패",
        description: "API 키 저장에 실패했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim() || !clientSecret.trim()) {
      toast({
        title: "입력 오류",
        description: "Client ID와 Client Secret을 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate({ clientId, clientSecret });
  };

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors p-3 md:p-4">
            <div className="flex items-center justify-between gap-2 md:gap-3">
              <div className="flex items-center gap-2 md:gap-3">
                <div
                  className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center ${
                    hasExistingKey ? "bg-emerald-500/10" : "bg-amber-500/10"
                  }`}
                >
                  {hasExistingKey ? (
                    <Shield className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Key className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-600 dark:text-amber-400" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-xs md:text-sm font-semibold">
                    API 키 설정
                  </CardTitle>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 hidden sm:block">
                    {hasExistingKey
                      ? "네이버 검색 API 등록됨"
                      : "네이버 검색 API 키 필요"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasExistingKey && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">
                    <Check className="w-3 h-3" />
                    <span className="hidden sm:inline">완료</span>
                  </div>
                )}
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 md:pb-6 px-4 md:px-6">
            {!hasExistingKey && (
              <div className="mb-4 md:mb-5 p-3 md:p-4 rounded-xl bg-gradient-to-r from-primary/5 to-violet-500/5 border border-primary/10">
                <p className="text-xs md:text-sm font-semibold text-foreground/90 mb-3">
                  API 키 발급 3단계
                </p>
                <div className="space-y-2 md:space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-[10px] md:text-xs font-bold text-primary">
                      1
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs md:text-sm text-foreground/80">
                        <a
                          href="https://developers.naver.com/products/service-api/search/search.md"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          네이버 개발자센터
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        에서 애플리케이션 등록
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-[10px] md:text-xs font-bold text-primary">
                      2
                    </div>
                    <p className="text-xs md:text-sm text-foreground/80">
                      발급받은 Client ID와 Secret을 아래에 입력
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-[10px] md:text-xs font-bold text-primary">
                      3
                    </div>
                    <p className="text-xs md:text-sm text-foreground/80">
                      저장 후 바로 검색 시작!
                    </p>
                  </div>
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
              <div className="grid sm:grid-cols-2 gap-3 md:gap-4 p-3 md:p-5 bg-muted/30 rounded-xl border border-border/30">
                <div className="space-y-1.5 md:space-y-2">
                  <Label
                    htmlFor="clientId"
                    className="text-xs md:text-sm font-semibold text-foreground/80"
                  >
                    Client ID
                  </Label>
                  <Input
                    id="clientId"
                    type="text"
                    placeholder="네이버 개발자센터 Client ID"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="font-mono text-xs md:text-sm bg-background h-9 md:h-10"
                    data-testid="input-client-id"
                  />
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <Label
                    htmlFor="clientSecret"
                    className="text-xs md:text-sm font-semibold text-foreground/80"
                  >
                    Client Secret
                  </Label>
                  <div className="relative">
                    <Input
                      id="clientSecret"
                      type={showSecret ? "text" : "password"}
                      placeholder={
                        hasExistingKey ? "변경 시에만 입력" : "Client Secret"
                      }
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      className="font-mono text-xs md:text-sm pr-10 bg-background h-9 md:h-10"
                      data-testid="input-client-secret"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowSecret(!showSecret)}
                      data-testid="button-toggle-secret"
                    >
                      {showSecret ? (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {hasExistingKey && (
                    <p className="text-[10px] md:text-xs text-muted-foreground mt-1 md:mt-1.5">
                      보안상 저장된 Secret은 표시되지 않습니다
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="font-semibold shadow-sm text-sm h-9 md:h-10"
                  data-testid="button-save-api-key"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-1.5 md:mr-2 h-4 w-4 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Check className="mr-1.5 md:mr-2 h-4 w-4" />
                      {hasExistingKey ? "수정하기" : "저장하기"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
