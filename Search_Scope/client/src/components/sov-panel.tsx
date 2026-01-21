import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ChevronLeft,
  ChevronRight,
  History,
  Save,
  FolderOpen,
  Trash2,
  Search,
} from "lucide-react";

interface SovRun {
  id: string;
  status: string;
  statusMessage?: string | null;
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

const ITEMS_PER_PAGE = 10;

export function SovPanel() {
  const { toast } = useToast();
  const [marketKeyword, setMarketKeyword] = useState("");
  const [brandInput, setBrandInput] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [pollingRunId, setPollingRunId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [loadTemplateOpen, setLoadTemplateOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("all");
  const [showResults, setShowResults] = useState(false);

  const { data: runs, isLoading: runsLoading } = useQuery<SovRun[]>({
    queryKey: ["/api/sov/runs"],
    refetchInterval: pollingRunId ? 3000 : false,
  });

  const selectedRunFromList = runs?.find((r) => r.id === selectedRunId);
  const isSelectedRunCompleted =
    selectedRunFromList?.status === "completed" ||
    selectedRunFromList?.status === "failed";

  const { data: selectedResult, isLoading: resultLoading } =
    useQuery<SovResultResponse>({
      queryKey: ["/api/sov/result", selectedRunId],
      enabled: !!selectedRunId && showResults,
      staleTime: isSelectedRunCompleted ? 5 * 60 * 1000 : 0,
      refetchInterval: selectedRunId && !isSelectedRunCompleted ? 3000 : false,
    });

  const { data: templates } = useQuery<SovTemplate[]>({
    queryKey: ["/api/sov/templates"],
  });

  const activeRun = useMemo(() => {
    return runs?.find((r) =>
      ["pending", "crawling", "extracting", "analyzing"].includes(r.status),
    );
  }, [runs]);

  const filteredRuns = useMemo(() => {
    if (!runs) return [];
    return runs.filter((run) => {
      const matchesSearch =
        historySearch === "" ||
        run.marketKeyword.toLowerCase().includes(historySearch.toLowerCase()) ||
        run.brands.some((b) =>
          b.toLowerCase().includes(historySearch.toLowerCase()),
        );
      let matchesStatus = false;
      if (historyStatusFilter === "all") {
        matchesStatus = true;
      } else if (historyStatusFilter === "running") {
        matchesStatus = [
          "pending",
          "crawling",
          "extracting",
          "analyzing",
        ].includes(run.status);
      } else {
        matchesStatus = run.status === historyStatusFilter;
      }
      return matchesSearch && matchesStatus;
    });
  }, [runs, historySearch, historyStatusFilter]);

  const totalPages = Math.ceil(filteredRuns.length / ITEMS_PER_PAGE);
  const paginatedRuns = filteredRuns.slice(
    (historyPage - 1) * ITEMS_PER_PAGE,
    historyPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setHistoryPage(1);
  }, [historySearch, historyStatusFilter]);

  const saveTemplateMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      marketKeyword: string;
      brands: string[];
    }) => {
      const response = await apiRequest("POST", "/api/sov/templates", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "템플릿 저장됨",
        description: "다음에 빠르게 불러올 수 있습니다.",
      });
      setSaveTemplateOpen(false);
      setTemplateName("");
      queryClient.invalidateQueries({ queryKey: ["/api/sov/templates"] });
    },
    onError: () => {
      toast({
        title: "저장 실패",
        description: "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
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
    toast({
      title: "템플릿 불러오기 완료",
      description: `"${template.name}" 템플릿이 적용되었습니다.`,
    });
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim() || !marketKeyword.trim() || brands.length === 0) {
      toast({
        title: "입력 오류",
        description: "템플릿 이름, 키워드, 브랜드가 필요합니다.",
        variant: "destructive",
      });
      return;
    }
    saveTemplateMutation.mutate({
      name: templateName.trim(),
      marketKeyword: marketKeyword.trim(),
      brands,
    });
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
      setShowResults(true);
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

  const handleViewResult = (runId: string) => {
    setSelectedRunId(runId);
    setShowResults(true);
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

  const getStatusBadgeVariant = (
    status: string,
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "completed":
        return "default";
      case "failed":
        return "destructive";
      case "crawling":
      case "extracting":
      case "analyzing":
        return "secondary";
      default:
        return "outline";
    }
  };

  useEffect(() => {
    const completedRun = runs?.find(
      (r) => r.id === pollingRunId && r.status === "completed",
    );
    if (completedRun && pollingRunId) {
      setPollingRunId(null);
      setSelectedRunId(completedRun.id);
    }
  }, [runs, pollingRunId]);

  useEffect(() => {
    if (selectedRunId) {
      queryClient.invalidateQueries({
        queryKey: ["/api/sov/result", selectedRunId],
      });
    }
  }, [selectedRunId]);

  useEffect(() => {
    if (
      selectedRunId &&
      selectedRunFromList?.status === "completed" &&
      selectedResult?.run?.status &&
      selectedResult.run.status !== "completed"
    ) {
      queryClient.invalidateQueries({
        queryKey: ["/api/sov/result", selectedRunId],
      });
    }
  }, [selectedRunId, selectedRunFromList?.status, selectedResult?.run?.status]);

  return (
    <div className="space-y-6">
      {/* 1. 새 분석 입력 영역 - 최상단, 항상 펼쳐짐 */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            SOV 분석
          </CardTitle>
          <CardDescription>
            시장 키워드에서 브랜드별 노출 점유율을 분석합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {templates && templates.length > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground shrink-0">
                빠른 선택:
              </span>
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

          <div className="grid gap-4 sm:grid-cols-2">
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
              <Label htmlFor="brand-input">브랜드 추가 (최대 10개)</Label>
              <div className="flex gap-2">
                <Input
                  id="brand-input"
                  data-testid="input-brand"
                  placeholder="브랜드명 입력 후 Enter"
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
            </div>
          </div>

          {brands.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {brands.map((brand) => (
                <Badge key={brand} variant="secondary" className="gap-1 py-1">
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

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              onClick={handleStartRun}
              disabled={
                !marketKeyword.trim() ||
                brands.length === 0 ||
                startRunMutation.isPending
              }
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
                              {template.marketKeyword} ·{" "}
                              {template.brands.length}개 브랜드
                            </p>
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              deleteTemplateMutation.mutate(template.id)
                            }
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
                    <p>
                      키워드:{" "}
                      <span className="font-medium">{marketKeyword}</span>
                    </p>
                    <p>
                      브랜드:{" "}
                      <span className="font-medium">{brands.join(", ")}</span>
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleSaveTemplate}
                    disabled={
                      !templateName.trim() || saveTemplateMutation.isPending
                    }
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
        </CardContent>
      </Card>

      {/* 2. 진행 중인 분석 상태 표시 (분석 중일 때 항상 표시) */}
      {activeRun && (
        <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="py-6">
            <div className="flex items-center gap-4 mb-6">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 shrink-0" />
              <div>
                <h3 className="font-medium">분석 진행 중</h3>
                <p className="text-sm text-muted-foreground">
                  {activeRun.marketKeyword} · {getStatusLabel(activeRun.status)}
                </p>
              </div>
            </div>
            <div className="max-w-xs mx-auto">
              <div className="flex items-start">
                {["crawling", "extracting", "analyzing"].map((step, idx) => {
                  const currentIdx = [
                    "pending",
                    "crawling",
                    "extracting",
                    "analyzing",
                  ].indexOf(activeRun.status);
                  const stepIdx = idx + 1;
                  const isActive = stepIdx === currentIdx;
                  const isCompleted = stepIdx < currentIdx;
                  const isLineCompleted = stepIdx < currentIdx;
                  return (
                    <div key={step} className="flex items-start flex-1">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 border-2 ${
                            isCompleted
                              ? "bg-green-500 border-green-500 text-white"
                              : isActive
                                ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30"
                                : "bg-background border-muted-foreground/30 text-muted-foreground"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            idx + 1
                          )}
                        </div>
                        <span
                          className={`text-xs mt-2 font-medium whitespace-nowrap ${
                            isCompleted
                              ? "text-green-600"
                              : isActive
                                ? "text-blue-600"
                                : "text-muted-foreground"
                          }`}
                        >
                          {step === "crawling"
                            ? "크롤링"
                            : step === "extracting"
                              ? "추출"
                              : "분석"}
                        </span>
                      </div>
                      {idx < 2 && (
                        <div
                          className={`flex-1 h-1 mt-[18px] mx-2 rounded-full transition-colors duration-300 ${
                            isLineCompleted ? "bg-green-500" : "bg-muted"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-6">
                {activeRun.statusMessage && (
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium text-center mb-3">
                    {activeRun.statusMessage}
                  </p>
                )}
                {parseInt(activeRun.totalExposures || "0") > 0 ? (
                  <>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span>{activeRun.processedExposures || "0"} / {activeRun.totalExposures} 처리됨</span>
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground/70">
                          {parseInt(activeRun.totalExposures) > parseInt(activeRun.processedExposures || "0")
                            ? `예상: 약 ${Math.ceil((parseInt(activeRun.totalExposures) - parseInt(activeRun.processedExposures || "0")) * 3)}초`
                            : "예상: 거의 완료"}
                        </span>
                        <span className="font-medium">
                          {Math.round((parseInt(activeRun.processedExposures || "0") / parseInt(activeRun.totalExposures)) * 100)}%
                        </span>
                      </span>
                    </div>
                    <Progress
                      value={
                        (parseInt(activeRun.processedExposures || "0") /
                          parseInt(activeRun.totalExposures)) *
                        100
                      }
                      className="h-2"
                    />
                  </>
                ) : !activeRun.statusMessage && (
                  <p className="text-xs text-muted-foreground text-center">
                    준비 중...
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. 분석 결과 표시 (완료/실패 시) */}
      {selectedRunId &&
        showResults &&
        selectedResult?.run &&
        ["completed", "failed"].includes(selectedResult.run.status) && (
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  분석 결과
                  <Badge variant="outline" className="ml-2 font-normal">
                    {selectedResult.run.marketKeyword}
                  </Badge>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowResults(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {selectedResult.run.status === "failed" ? (
                <div className="text-center py-8">
                  <XCircle className="w-8 h-8 mx-auto mb-4 text-red-500" />
                  <p className="text-muted-foreground">
                    분석 중 오류가 발생했습니다.
                  </p>
                  <p className="text-sm text-red-500 mt-2">
                    {selectedResult.run.errorMessage || "알 수 없는 오류"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground">
                      브랜드별 점유율
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[...selectedResult.results]
                        .sort((a, b) => b.sovPercentage - a.sovPercentage)
                        .map((result, idx) => (
                          <Card
                            key={result.brand}
                            className={`bg-gradient-to-br ${idx === 0 ? "from-primary/10 to-primary/5 border-primary/30" : "from-card to-muted/20"}`}
                          >
                            <CardContent className="py-3 px-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium truncate">
                                  {result.brand}
                                </span>
                                {idx === 0 && (
                                  <Badge className="text-[10px] px-1.5 py-0">
                                    1위
                                  </Badge>
                                )}
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
                        <span>
                          총 {selectedResult.run.totalExposures}건 분석
                        </span>
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
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground">
                      분석된 콘텐츠 ({selectedResult.exposures.length}건)
                    </h4>
                    <ScrollArea className="h-[280px] rounded-md border p-3">
                      <div className="space-y-2">
                        {selectedResult.exposures.map((exposure) => {
                          const isVerified =
                            exposure.extractionStatus?.startsWith("success");
                          const isMetadata =
                            exposure.extractionStatus === "success_metadata";
                          return (
                            <div
                              key={exposure.id}
                              className={`flex items-center justify-between p-2.5 rounded-lg transition-colors ${
                                isVerified
                                  ? "bg-muted/50 hover:bg-muted"
                                  : "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900"
                              }`}
                            >
                              <a
                                href={exposure.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2.5 flex-1 min-w-0 hover:text-primary transition-colors group"
                              >
                                <Badge
                                  variant="outline"
                                  className="shrink-0 text-[10px]"
                                >
                                  {exposure.blockType}
                                </Badge>
                                <span className="truncate text-sm group-hover:underline">
                                  {exposure.title}
                                </span>
                                <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                                {isMetadata && (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 text-[10px] text-blue-600 border-blue-300"
                                  >
                                    메타 기반
                                  </Badge>
                                )}
                                {!isVerified && (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 text-[10px] text-amber-600 border-amber-300"
                                  >
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

      {/* 4. 분석 기록 - 페이지네이션 테이블 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="w-4 h-4" />
              분석 기록
              {runs && runs.length > 0 && (
                <Badge variant="secondary" className="text-xs ml-1">
                  총 {runs.length}건
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="키워드/브랜드 검색"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="pl-8 h-8 w-40 text-sm"
                />
              </div>
              <Select
                value={historyStatusFilter}
                onValueChange={setHistoryStatusFilter}
              >
                <SelectTrigger className="h-8 w-28 text-sm">
                  <SelectValue placeholder="상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                  <SelectItem value="failed">실패</SelectItem>
                  <SelectItem value="running">진행 중</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: ["/api/sov/runs"] })
                }
                data-testid="button-refresh-runs"
                aria-label="새로고침"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {runsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !runs || runs.length === 0 ? (
            <div className="py-8 text-center border rounded-lg border-dashed">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                아직 분석 기록이 없습니다.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                위에서 시장 키워드와 브랜드를 입력하고 분석을 시작해보세요.
              </p>
            </div>
          ) : filteredRuns.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">검색 결과가 없습니다.</p>
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">키워드</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        브랜드
                      </TableHead>
                      <TableHead className="w-[100px]">상태</TableHead>
                      <TableHead className="w-[150px] hidden md:table-cell">
                        일시
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRuns.map((run) => (
                      <TableRow
                        key={run.id}
                        className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                          selectedRunId === run.id ? "bg-primary/5" : ""
                        }`}
                        onClick={() => handleViewResult(run.id)}
                      >
                        <TableCell className="font-medium">
                          {run.marketKeyword}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex flex-wrap gap-1.5 max-w-[300px]">
                            {run.brands.slice(0, 5).map((brand) => (
                              <Badge
                                key={brand}
                                variant="outline"
                                className="text-xs px-2 py-0.5"
                              >
                                {brand}
                              </Badge>
                            ))}
                            {run.brands.length > 5 && (
                              <Badge
                                variant="secondary"
                                className="text-xs px-2 py-0.5"
                              >
                                +{run.brands.length - 5}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={getStatusBadgeVariant(run.status)}
                            className="gap-1"
                          >
                            {getStatusIcon(run.status)}
                            <span className="hidden sm:inline">
                              {getStatusLabel(run.status)}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm hidden md:table-cell whitespace-nowrap">
                          {new Date(run.createdAt).toLocaleDateString("ko-KR", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {filteredRuns.length}건 중{" "}
                    {(historyPage - 1) * ITEMS_PER_PAGE + 1}-
                    {Math.min(
                      historyPage * ITEMS_PER_PAGE,
                      filteredRuns.length,
                    )}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      disabled={historyPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm px-2">
                      {historyPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        setHistoryPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={historyPage === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
