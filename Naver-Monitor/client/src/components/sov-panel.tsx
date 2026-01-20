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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  History,
  Save,
  FolderOpen,
  Trash2
} from "lucide-react";

interface SovRun {
  id: string;
  status: string;
  marketKeyword: string;
  brands: string[];
  totalExposures: string;
  processedExposures?: string;
  verifiedCount?: number;
  unverifiedCount?: number;
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

interface SovTemplate {
  id: string;
  name: string;
  marketKeyword: string;
  brands: string[];
  createdAt: string;
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
  const [inputExpanded, setInputExpanded] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [loadTemplateOpen, setLoadTemplateOpen] = useState(false);

  const { data: runs, isLoading: runsLoading } = useQuery<SovRun[]>({
    queryKey: ["/api/sov/runs"],
    refetchInterval: pollingRunId ? 3000 : false,
  });

  const selectedRunFromList = runs?.find(r => r.id === selectedRunId);
  const isSelectedRunCompleted = selectedRunFromList?.status === "completed" || selectedRunFromList?.status === "failed";
  
  const { data: selectedResult, isLoading: resultLoading, refetch: refetchResult } = useQuery<SovResultResponse>({
    queryKey: ["/api/sov/result", selectedRunId],
    enabled: !!selectedRunId,
    staleTime: isSelectedRunCompleted ? 5 * 60 * 1000 : 0,
    refetchInterval: selectedRunId && !isSelectedRunCompleted ? 3000 : false,
  });

  const { data: templates } = useQuery<SovTemplate[]>({
    queryKey: ["/api/sov/templates"],
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; marketKeyword: string; brands: string[] }) => {
      const response = await apiRequest("POST", "/api/sov/templates", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "템플릿 저장됨", description: "다음에 빠르게 불러올 수 있습니다." });
      setSaveTemplateOpen(false);
      setTemplateName("");
      queryClient.invalidateQueries({ queryKey: ["/api/sov/templates"] });
    },
    onError: () => {
      toast({ title: "저장 실패", description: "잠시 후 다시 시도해주세요.", variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/sov/templates/${id}`);
    },
    onSuccess: () => {
      toast({ title: "템플릿 삭제됨" });
      queryClient.invalidateQueries({ queryKey: ["/api/sov/templates"] });
    },
  });

  const handleLoadTemplate = (template: SovTemplate) => {
    setMarketKeyword(template.marketKeyword);
    setBrands(template.brands);
    setLoadTemplateOpen(false);
    toast({ title: "템플릿 불러오기 완료", description: `"${template.name}" 템플릿이 적용되었습니다.` });
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim() || !marketKeyword.trim() || brands.length === 0) {
      toast({ title: "입력 오류", description: "템플릿 이름, 키워드, 브랜드가 필요합니다.", variant: "destructive" });
      return;
    }
    saveTemplateMutation.mutate({ name: templateName.trim(), marketKeyword: marketKeyword.trim(), brands });
  };

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
    if (selectedRunId) {
      queryClient.invalidateQueries({ queryKey: ["/api/sov/result", selectedRunId] });
    }
  }, [selectedRunId]);

  useEffect(() => {
    if (selectedRunId && selectedRunFromList?.status === "completed" && 
        selectedResult?.run?.status && selectedResult.run.status !== "completed") {
      queryClient.invalidateQueries({ queryKey: ["/api/sov/result", selectedRunId] });
    }
  }, [selectedRunId, selectedRunFromList?.status, selectedResult?.run?.status]);

  useEffect(() => {
    if (!runsLoading && !hasInitialized) {
      setHasInitialized(true);
      const hasRuns = runs && runs.length > 0;
      setInputExpanded(!hasRuns);
      if (hasRuns && !selectedRunId) {
        const latestCompleted = runs.find(r => r.status === "completed");
        if (latestCompleted) {
          setSelectedRunId(latestCompleted.id);
        }
      }
    }
  }, [runsLoading, runs, hasInitialized, selectedRunId]);

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
              <div className="py-8 space-y-6">
                <div className="flex justify-center">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                </div>
                <div className="max-w-md mx-auto">
                  <div className="flex items-center justify-between mb-4">
                    {["crawling", "extracting", "analyzing"].map((step, idx) => {
                      const currentIdx = ["pending", "crawling", "extracting", "analyzing"].indexOf(selectedResult.run.status);
                      const stepIdx = idx + 1;
                      const isActive = stepIdx === currentIdx;
                      const isCompleted = stepIdx < currentIdx;
                      return (
                        <div key={step} className="flex-1 flex items-center">
                          <div className={`flex flex-col items-center flex-1 ${idx > 0 ? 'ml-2' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                              isCompleted ? 'bg-green-500 text-white' : 
                              isActive ? 'bg-primary text-white animate-pulse' : 
                              'bg-muted text-muted-foreground'
                            }`}>
                              {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                            </div>
                            <span className={`text-[10px] mt-1 ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                              {step === "crawling" ? "크롤링" : step === "extracting" ? "추출" : "분석"}
                            </span>
                          </div>
                          {idx < 2 && <div className={`h-0.5 w-full ${isCompleted ? 'bg-green-500' : 'bg-muted'}`} />}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-center text-muted-foreground text-sm">
                    {getStatusLabel(selectedResult.run.status)}... 잠시만 기다려주세요.
                  </p>
                  {selectedResult.run.processedExposures && selectedResult.run.totalExposures && (
                    <div className="mt-4">
                      <Progress 
                        value={(parseInt(selectedResult.run.processedExposures) / parseInt(selectedResult.run.totalExposures)) * 100} 
                        className="h-2"
                      />
                      <p className="text-xs text-center text-muted-foreground mt-2">
                        {selectedResult.run.processedExposures} / {selectedResult.run.totalExposures} 처리됨
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 왼쪽: SOV 요약 지표 */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">브랜드별 점유율</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[...selectedResult.results].sort((a, b) => b.sovPercentage - a.sovPercentage).map((result, idx) => (
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
                  <div className="text-xs text-muted-foreground pt-2 border-t space-y-1">
                    <div className="flex items-center gap-3">
                      <span>총 {selectedResult.run.totalExposures}건 분석</span>
                      {selectedResult.run.verifiedCount !== undefined && (
                        <>
                          <span className="text-green-600">
                            <CheckCircle2 className="w-3 h-3 inline mr-0.5" />
                            확인 {selectedResult.run.verifiedCount}건
                          </span>
                          {(selectedResult.run.unverifiedCount ?? 0) > 0 && (
                            <span className="text-amber-600">
                              미확인 {selectedResult.run.unverifiedCount}건
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    {(selectedResult.run.unverifiedCount ?? 0) > 0 && (
                      <p className="text-[10px] text-muted-foreground/70">
                        * 점유율은 본문 확인된 콘텐츠 기준으로 계산됩니다
                      </p>
                    )}
                  </div>
                </div>

                {/* 오른쪽: 노출 목록 (스크롤 영역) */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">
                    분석된 콘텐츠 ({selectedResult.exposures.length}건)
                  </h4>
                  <ScrollArea className="h-[280px] rounded-md border p-3">
                    <div className="space-y-2">
                      {selectedResult.exposures.map((exposure) => {
                        const isVerified = exposure.extractionStatus?.startsWith("success");
                        return (
                          <div
                            key={exposure.id}
                            className={`flex items-center justify-between p-2.5 rounded-lg transition-colors ${
                              isVerified 
                                ? 'bg-muted/50 hover:bg-muted' 
                                : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900'
                            }`}
                          >
                            <a
                              href={exposure.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2.5 flex-1 min-w-0 hover:text-primary transition-colors group"
                            >
                              <Badge variant="outline" className="shrink-0 text-[10px]">
                                {exposure.blockType}
                              </Badge>
                              <span className="truncate text-sm group-hover:underline">{exposure.title}</span>
                              <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                              {!isVerified && (
                                <Badge variant="outline" className="shrink-0 text-[10px] text-amber-600 border-amber-300">
                                  미확인
                                </Badge>
                              )}
                            </a>
                          </div>
                        );
                      })}
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
              {templates && templates.length > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 mb-2">
                  <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground shrink-0">빠른 선택:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {templates.slice(0, 4).map((template) => (
                      <Badge
                        key={template.id}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors"
                        onClick={() => handleLoadTemplate(template)}
                      >
                        {template.name}
                      </Badge>
                    ))}
                    {templates.length > 4 && (
                      <Badge
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => setLoadTemplateOpen(true)}
                      >
                        +{templates.length - 4}개 더보기
                      </Badge>
                    )}
                  </div>
                </div>
              )}

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

              <div className="flex gap-2">
                <Dialog open={loadTemplateOpen} onOpenChange={setLoadTemplateOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <FolderOpen className="w-3.5 h-3.5" />
                      불러오기
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>템플릿 불러오기</DialogTitle>
                      <DialogDescription>
                        저장된 키워드+브랜드 조합을 선택하세요
                      </DialogDescription>
                    </DialogHeader>
                    {templates && templates.length > 0 ? (
                      <ScrollArea className="max-h-[300px]">
                        <div className="space-y-2">
                          {templates.map((template) => (
                            <div
                              key={template.id}
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                            >
                              <button
                                onClick={() => handleLoadTemplate(template)}
                                className="flex-1 text-left"
                              >
                                <p className="font-medium">{template.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {template.marketKeyword} · {template.brands.length}개 브랜드
                                </p>
                              </button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteTemplateMutation.mutate(template.id)}
                                disabled={deleteTemplateMutation.isPending}
                              >
                                <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        저장된 템플릿이 없습니다
                      </p>
                    )}
                  </DialogContent>
                </Dialog>

                <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={!marketKeyword.trim() || brands.length === 0}
                    >
                      <Save className="w-3.5 h-3.5" />
                      저장
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>템플릿으로 저장</DialogTitle>
                      <DialogDescription>
                        현재 키워드와 브랜드 조합을 저장합니다
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label htmlFor="template-name">템플릿 이름</Label>
                        <Input
                          id="template-name"
                          placeholder="예: 전기차 시장 분석"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                        />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>키워드: <span className="font-medium">{marketKeyword}</span></p>
                        <p>브랜드: <span className="font-medium">{brands.join(", ")}</span></p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={handleSaveTemplate}
                        disabled={!templateName.trim() || saveTemplateMutation.isPending}
                      >
                        {saveTemplateMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        저장
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
