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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Edit3,
  History
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
  const [inputExpanded, setInputExpanded] = useState<boolean | undefined>(undefined);
  const [historyExpanded, setHistoryExpanded] = useState(false);

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
      setSelectedRunId(data.runId);
      setMarketKeyword("");
      setBrands([]);
      setInputExpanded(false);
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
      setSelectedRunId(completedRun.id);
    }
  }, [runs, pollingRunId]);

  useEffect(() => {
    if (!runsLoading && inputExpanded === undefined) {
      const hasRuns = runs && runs.length > 0;
      setInputExpanded(!hasRuns);
      if (hasRuns && !selectedRunId) {
        const latestCompleted = runs.find(r => r.status === "completed");
        if (latestCompleted) {
          setSelectedRunId(latestCompleted.id);
        }
      }
    }
  }, [runsLoading, runs, inputExpanded, selectedRunId]);

  const lastRun = runs?.[0];

  return (
    <div className="space-y-4">
      {/* 1. 분석 결과 - 최상단 배치 (결과가 있을 때) */}
      {selectedRunId && (
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                분석 결과
                {selectedResult?.run && (
                  <Badge variant="outline" className="ml-2 font-normal">
                    {selectedResult.run.marketKeyword}
                  </Badge>
                )}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInputExpanded(true)}
                className="gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                새 분석
              </Button>
            </div>
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 왼쪽: SOV 요약 지표 */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">브랜드별 점유율</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedResult.results.map((result, idx) => (
                      <Card key={result.brand} className={`bg-gradient-to-br ${idx === 0 ? 'from-primary/10 to-primary/5 border-primary/30' : 'from-card to-muted/20'}`}>
                        <CardContent className="py-3 px-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium truncate">{result.brand}</span>
                            {idx === 0 && <Badge className="text-[10px] px-1.5 py-0">1위</Badge>}
                          </div>
                          <p className="text-2xl font-bold text-primary">
                            {result.sovPercentage.toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {result.exposureCount}건 노출
                          </p>
                          <Progress
                            value={result.sovPercentage}
                            className="mt-2 h-1.5"
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    총 {selectedResult.run.totalExposures}건의 콘텐츠 분석 완료
                  </div>
                </div>

                {/* 오른쪽: 노출 목록 (스크롤 영역) */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">
                    분석된 콘텐츠 ({selectedResult.exposures.length}건)
                  </h4>
                  <ScrollArea className="h-[280px] rounded-md border p-3">
                    <div className="space-y-2">
                      {selectedResult.exposures.map((exposure) => (
                        <div
                          key={exposure.id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {exposure.blockType}
                            </Badge>
                            <span className="truncate text-sm">{exposure.title}</span>
                          </div>
                          <a
                            href={exposure.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 ml-2 p-1 hover:bg-background rounded"
                            aria-label="외부 링크 열기"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 2. 입력 영역 - 접기/펼치기 가능 */}
      <Collapsible open={inputExpanded} onOpenChange={setInputExpanded}>
        <Card className={`border-2 transition-colors ${inputExpanded ? 'border-primary/20 bg-gradient-to-br from-primary/5 to-transparent' : 'border-muted'}`}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  {inputExpanded ? 'SOV 분석 설정' : '새 SOV 분석 시작'}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {!inputExpanded && brands.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {brands.length}개 브랜드
                    </Badge>
                  )}
                  {inputExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              {!inputExpanded && (
                <CardDescription className="mt-1">
                  클릭하여 새 분석을 시작하거나 검색 조건을 수정하세요
                </CardDescription>
              )}
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <CardDescription className="pb-2">
                시장 키워드에서 브랜드별 노출 점유율을 분석합니다.
                네이버 검색 스마트블록의 콘텐츠를 분석하여 브랜드 관련성을 계산합니다.
              </CardDescription>
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
                    aria-label="브랜드 추가"
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
                          aria-label={`${brand} 삭제`}
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
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 3. 분석 기록 - 접기/펼치기 가능 */}
      {runs && runs.length > 0 && (
        <Collapsible open={historyExpanded} onOpenChange={setHistoryExpanded}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="w-4 h-4" />
                    분석 기록
                    <Badge variant="secondary" className="text-xs ml-1">
                      {runs.length}건
                    </Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {lastRun && !historyExpanded && (
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        최근: {lastRun.marketKeyword} ({getStatusLabel(lastRun.status)})
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        queryClient.invalidateQueries({ queryKey: ["/api/sov/runs"] });
                      }}
                      data-testid="button-refresh-runs"
                      aria-label="새로고침"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                    {historyExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                {runsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {runs.map((run) => (
                      <div
                        key={run.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedRunId === run.id
                            ? "border-primary bg-primary/5"
                            : "hover:border-primary/50 hover:bg-muted/30"
                        }`}
                        onClick={() => setSelectedRunId(run.id)}
                        data-testid={`card-sov-run-${run.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(run.status)}
                            <div>
                              <p className="font-medium text-sm">{run.marketKeyword}</p>
                              <p className="text-xs text-muted-foreground">
                                {run.brands.join(", ")}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className="text-[10px]">{getStatusLabel(run.status)}</Badge>
                            <p className="text-[10px] text-muted-foreground mt-1">
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
                            className="mt-2 h-1.5"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* 분석 기록이 없을 때 안내 */}
      {!runsLoading && (!runs || runs.length === 0) && !selectedRunId && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              아직 분석 기록이 없습니다.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              위에서 시장 키워드와 브랜드를 입력하고 분석을 시작해보세요.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
