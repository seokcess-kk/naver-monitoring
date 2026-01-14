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
import { Key, ChevronDown, Check, Loader2, Eye, EyeOff, Shield } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { ApiKeyPublic } from "@shared/schema";

interface ApiKeySetupProps {
  existingApiKey: ApiKeyPublic | undefined;
  onSave: () => void;
}

export function ApiKeySetup({ existingApiKey, onSave }: ApiKeySetupProps) {
  const hasExistingKey = !!existingApiKey?.hasClientSecret;
  const [isOpen, setIsOpen] = useState(!hasExistingKey);
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
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  hasExistingKey 
                    ? "bg-gradient-to-br from-emerald-500/20 to-emerald-500/5" 
                    : "bg-gradient-to-br from-amber-500/20 to-amber-500/5"
                }`}>
                  {hasExistingKey ? (
                    <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Key className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-base font-bold">API 키 설정</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {hasExistingKey ? "네이버 검색 API 키가 등록되어 있습니다" : "네이버 검색 API 키를 등록하세요"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {hasExistingKey && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                    <Check className="w-3.5 h-3.5" />
                    등록 완료
                  </div>
                )}
                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4 p-5 bg-muted/30 rounded-xl border border-border/30">
                <div className="space-y-2">
                  <Label htmlFor="clientId" className="text-sm font-semibold text-foreground/80">
                    Client ID
                  </Label>
                  <Input
                    id="clientId"
                    type="text"
                    placeholder="네이버 개발자센터 Client ID"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="font-mono text-sm bg-background"
                    data-testid="input-client-id"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientSecret" className="text-sm font-semibold text-foreground/80">
                    Client Secret
                  </Label>
                  <div className="relative">
                    <Input
                      id="clientSecret"
                      type={showSecret ? "text" : "password"}
                      placeholder={hasExistingKey ? "변경 시에만 입력" : "네이버 개발자센터 Client Secret"}
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      className="font-mono text-sm pr-10 bg-background"
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
                    <p className="text-xs text-muted-foreground mt-1.5">
                      보안상 저장된 Secret은 표시되지 않습니다
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="font-semibold shadow-sm"
                  data-testid="button-save-api-key"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
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
