import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Loader2, Sparkles, AlertCircle, Key } from "lucide-react";

interface SearchPanelProps {
  onSearch: (keyword: string, sort: "sim" | "date") => void;
  isSearching: boolean;
  hasApiKey: boolean;
  onOpenApiKeySetup?: () => void;
}

export function SearchPanel({
  onSearch,
  isSearching,
  hasApiKey,
  onOpenApiKeySetup,
}: SearchPanelProps) {
  const [keyword, setKeyword] = useState("");
  const [sortType, setSortType] = useState<"sim" | "date">("sim");
  const [keywordError, setKeywordError] = useState("");
  const [searchProgress, setSearchProgress] = useState(0);
  const [estimatedRemaining, setEstimatedRemaining] = useState<string>("");
  const searchStartTimeRef = useRef<number | null>(null);
  const keywordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearching) {
      const startTime = Date.now();
      searchStartTimeRef.current = startTime;
      setSearchProgress(0);
      const estimatedTotal = 4000;
      
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const newProgress = Math.min(90, (elapsed / estimatedTotal) * 100);
        setSearchProgress(newProgress);
        
        const remaining = Math.max(0, estimatedTotal - elapsed);
        if (remaining > 1000) {
          setEstimatedRemaining(`약 ${Math.ceil(remaining / 1000)}초 남음`);
        } else if (remaining > 0) {
          setEstimatedRemaining("거의 완료");
        }
      }, 100);
      return () => clearInterval(interval);
    } else {
      if (searchStartTimeRef.current) {
        setSearchProgress(100);
        setEstimatedRemaining("완료!");
        const timeout = setTimeout(() => {
          setSearchProgress(0);
          setEstimatedRemaining("");
          searchStartTimeRef.current = null;
        }, 500);
        return () => clearTimeout(timeout);
      }
    }
  }, [isSearching]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setKeywordError("");
    
    if (!keyword.trim()) {
      setKeywordError("모니터링할 키워드를 입력해주세요.");
      keywordInputRef.current?.focus();
      return;
    }
    if (!hasApiKey) {
      return;
    }
    onSearch(keyword, sortType);
  };

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-primary via-violet-500 to-sky-500" />
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center gap-2.5 md:gap-3 mb-4 md:mb-5">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-bold tracking-tight">통합검색</h2>
          </div>
        </div>

        {!hasApiKey && (
          <div className="mb-4 p-3 md:p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm font-medium text-amber-800 dark:text-amber-200">
                검색을 시작하려면 API 키를 먼저 등록하세요
              </p>
              <p className="text-[10px] md:text-xs text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                네이버 개발자센터에서 발급받은 Client ID와 Secret이 필요합니다.
              </p>
            </div>
            {onOpenApiKeySetup && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenApiKeySetup}
                className="shrink-0 text-xs h-8 border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
              >
                <Key className="w-3 h-3 mr-1.5" />
                키 등록
              </Button>
            )}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex flex-col md:flex-row gap-3 md:gap-4 items-end"
        >
          <div className="flex-1 w-full">
            <label className="block text-xs md:text-sm font-semibold mb-1.5 md:mb-2 text-foreground/80">
              모니터링 키워드
            </label>
            <div className="relative">
              <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground/60" />
              <Input
                ref={keywordInputRef}
                type="search"
                placeholder="예: 강남 맛집, 다이어트한의원"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  if (keywordError) setKeywordError("");
                }}
                className={`pl-10 md:pl-12 h-10 md:h-12 text-sm md:text-base bg-muted/30 border-border/50 focus:bg-background transition-colors ${
                  keywordError ? "border-red-500 focus:ring-red-500" : ""
                }`}
                data-testid="input-search-keyword"
              />
            </div>
            {keywordError && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {keywordError}
              </p>
            )}
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <div className="flex-1 md:w-36 lg:w-44">
              <label className="block text-xs md:text-sm font-semibold mb-1.5 md:mb-2 text-foreground/80">
                정렬
              </label>
              <Select
                value={sortType}
                onValueChange={(v) => setSortType(v as "sim" | "date")}
              >
                <SelectTrigger
                  className="h-10 md:h-12 bg-muted/30 border-border/50 text-sm"
                  data-testid="select-sort-type"
                >
                  <SelectValue placeholder="정렬" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">정확도순</SelectItem>
                  <SelectItem value="date">최신순</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isSearching || !hasApiKey}
              className="flex-1 md:flex-initial h-10 md:h-12 px-4 md:px-8 font-semibold shadow-sm self-end text-sm md:text-base"
              data-testid="button-search"
            >
              {isSearching ? (
                <>
                  <Loader2 className="mr-1.5 md:mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" />
                  <span className="hidden sm:inline">검색 중...</span>
                  <span className="sm:hidden">검색</span>
                </>
              ) : (
                <>
                  <Search className="mr-1.5 md:mr-2 h-4 w-4 md:h-5 md:w-5" />
                  검색
                </>
              )}
            </Button>
          </div>
        </form>

        {isSearching && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                검색 진행 중...
              </span>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground/70">
                  {estimatedRemaining ? `예상: ${estimatedRemaining}` : "예상: 계산 중..."}
                </span>
                <span className="font-medium">{Math.round(searchProgress)}%</span>
              </span>
            </div>
            <Progress value={searchProgress} className="h-1.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
