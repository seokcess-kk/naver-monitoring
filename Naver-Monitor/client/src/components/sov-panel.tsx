import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  BarChart3, 
  Play, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  TrendingUp,
  ExternalLink,
  Plus,
  X,
  RefreshCw
} from "lucide-react";

interface SovRun {
  id: string;
  status: string;
  marketKeyword: string;
  brands: string[];
  totalExposures: string;
  processedExposures?: string;
  errorMessage?: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface SovResult {
  brand: string;
  exposureCount: number;
  sovPercentage: number;
}

interface SovResultByType {
  blockType: string;
  brand: string;
  exposureCount: number;
  totalInType: number;
  sovPercentage: number;
}

interface SovExposure {
  id: string;
  blockType: string;
  title: string;
  url: string;
  position: number;
  extractionStatus: string;
}

interface SovResultResponse {
  run: SovRun;
  results: SovResult[];
  resultsByType: SovResultByType[];
  exposures: SovExposure[];
}

export function SovPanel() {
  const { toast } = useToast();
  const [marketKeyword, setMarketKeyword] = useState("");
  const [brandInput, setBrandInput] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [pollingRunId, setPollingRunId] = useState<string | null>(null);

  const { data: runs, isLoading: runsLoading } = useQuery<SovRun[]>({
    queryKey: ["/api/sov/runs"],
    refetchInterval: pollingRunId ? 3000 : false,
  });

  const { data: selectedResult, isLoading: resultLoading } = useQuery<SovResultResponse>({
    queryKey: ["/api/sov/result", selectedRunId],
    enabled: !!selectedRunId,
  });

  const startRunMutation = useMutation({
    mutationFn: async (data: { marketKeyword: string; brands: string[] }) => {
      const response = await apiRequest("POST", "/api/sov/run", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "SOV 분석 시작",
        description: "분석이 백그라운드에서 실행 중입니다.",
      });
      setPollingRunId(data.runId);
      setMarketKeyword("");
      setBrands([]);
      queryClient.invalidateQueries({ queryKey: ["/api/sov/runs"] });
    },
    onError: () => {
      toast({
        title: "분석 시작 실패",
        description: "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    },
  });

  const handleAddBrand = () => {
    const trimmed = brandInput.trim();
    if (trimmed && !brands.includes(trimmed) && brands.length < 10) {
      setBrands([...brands, trimmed]);
      setBrandInput("");
    }
  };

  const handleRemoveBrand = (brand: string) => {
    setBrands(brands.filter((b) => b !== brand));
  };

  const handleStartRun = () => {
    if (!marketKeyword.trim() || brands.length === 0) {
      toast({
        title: "입력 오류",
        description: "시장 키워드와 최소 1개의 브랜드를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }
    startRunMutation.mutate({ marketKeyword: marketKeyword.trim(), brands });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case "crawling":
      case "extracting":
      case "analyzing":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "대기 중";
      case "crawling":
        return "크롤링 중";
      case "extracting":
        return "콘텐츠 추출 중";
      case "analyzing":
        return "분석 중";
      case "completed":
        return "완료";
      case "failed":
        return "실패";
      default:
        return status;
    }
  };

  useEffect(() => {
    const completedRun = runs?.find((r) => r.id === pollingRunId && r.status === "completed");
    if (completedRun && pollingRunId) {
      setPollingRunId(null);
    }
  }, [runs, pollingRunId]);

  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            SOV (Share of Voice) 분석
          </CardTitle>
          <CardDescription>
            시장 키워드에서 브랜드별 노출 점유율을 분석합니다.
            네이버 검색 스마트블록(뉴스, VIEW, 블로그)의 콘텐츠를 분석하여 브랜드 관련성을 계산합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="market-keyword">시장 키워드</Label>
            <Input
              id="market-keyword"
              data-testid="input-market-keyword"
              placeholder="예: 전기차, 커피머신, 노트북"
              value={marketKeyword}
              onChange={(e) => setMarketKeyword(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand-input">분석할 브랜드 (최대 10개)</Label>
            <div className="flex gap-2">
              <Input
                id="brand-input"
                data-testid="input-brand"
                placeholder="브랜드명 입력"
                value={brandInput}
                onChange={(e) => setBrandInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddBrand();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddBrand}
                disabled={!brandInput.trim() || brands.length >= 10}
                data-testid="button-add-brand"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {brands.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {brands.map((brand) => (
                  <Badge key={brand} variant="secondary" className="gap-1">
                    {brand}
                    <button
                      type="button"
                      onClick={() => handleRemoveBrand(brand)}
                      className="ml-1 hover:text-destructive"
                      data-testid={`button-remove-brand-${brand}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={handleStartRun}
            disabled={!marketKeyword.trim() || brands.length === 0 || startRunMutation.isPending}
            className="w-full"
            data-testid="button-start-sov"
          >
            {startRunMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                분석 시작 중...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                SOV 분석 시작
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              분석 기록
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/sov/runs"] })}
              data-testid="button-refresh-runs"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !runs || runs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              아직 분석 기록이 없습니다. 위에서 새 분석을 시작해보세요.
            </p>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedRunId === run.id
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50 hover-elevate"
                  }`}
                  onClick={() => setSelectedRunId(run.id)}
                  data-testid={`card-sov-run-${run.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(run.status)}
                      <div>
                        <p className="font-medium">{run.marketKeyword}</p>
                        <p className="text-sm text-muted-foreground">
                          {run.brands.join(", ")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">{getStatusLabel(run.status)}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(run.createdAt).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                  </div>
                  {(run.status === "crawling" || run.status === "extracting" || run.status === "analyzing") && (
                    <Progress
                      value={
                        run.processedExposures && run.totalExposures
                          ? (parseInt(run.processedExposures) / parseInt(run.totalExposures)) * 100
                          : 0
                      }
                      className="mt-3 h-2"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedRunId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              분석 결과
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resultLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : !selectedResult ? (
              <p className="text-muted-foreground text-center py-8">
                결과를 불러오는 중 오류가 발생했습니다.
              </p>
            ) : selectedResult.run.status === "failed" ? (
              <div className="text-center py-8">
                <XCircle className="w-8 h-8 mx-auto mb-4 text-red-500" />
                <p className="text-muted-foreground">
                  분석 중 오류가 발생했습니다.
                </p>
                <p className="text-sm text-red-500 mt-2">
                  {selectedResult.run.errorMessage || "알 수 없는 오류"}
                </p>
              </div>
            ) : selectedResult.run.status !== "completed" ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">
                  {getStatusLabel(selectedResult.run.status)}... 잠시만 기다려주세요.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedResult.results.map((result) => (
                    <Card key={result.brand} className="bg-gradient-to-br from-card to-muted/20">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">
                            {result.brand}
                          </p>
                          <p className="text-3xl font-bold text-primary">
                            {result.sovPercentage.toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {result.exposureCount}건 / {selectedResult.run.totalExposures}건
                          </p>
                        </div>
                        <Progress
                          value={result.sovPercentage}
                          className="mt-3 h-2"
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div>
                  <h4 className="font-medium mb-3">분석된 콘텐츠 ({selectedResult.exposures.length}건)</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedResult.exposures.map((exposure) => (
                      <div
                        key={exposure.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Badge variant="outline" className="shrink-0">
                            {exposure.blockType}
                          </Badge>
                          <span className="truncate text-sm">{exposure.title}</span>
                        </div>
                        <a
                          href={exposure.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 ml-2"
                          data-testid={`link-exposure-${exposure.id}`}
                        >
                          <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-primary" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
