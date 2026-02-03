import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { SearchPanel } from "@/components/search-panel";
import { SmartBlockSection } from "@/components/smart-block-section";
import { ApiResultsSection } from "@/components/api-results-section";
import { KeywordInsightCard } from "@/components/keyword-insight-card";
import { KeywordTrendChart } from "@/components/keyword-trend-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Clock,
  Sparkles,
  FileText,
  MessageSquare,
  HelpCircle,
  Newspaper,
  X,
  Highlighter,
} from "lucide-react";

const RECENT_SEARCHES_KEY = "search-scope-recent-searches";
const MAX_RECENT_SEARCHES = 5;
const SEARCH_RESULTS_KEY = "search-scope-search-results";
const SEARCH_STATE_KEY = "search-scope-search-state";

interface TrendDataPoint {
  period: string;
  ratio: number;
}

interface KeywordInsight {
  keyword: string;
  totalVolume: number;
  pcVolume: number;
  mobileVolume: number;
  compIdx: string;
  momGrowth: number | null;
  yoyGrowth: number | null;
  trend: TrendDataPoint[] | null;
}

interface QuotaStatus {
  clientId: string;
  used: number;
  limit: number;
  remaining: number;
  percentageUsed: number;
  status: "ok" | "warning" | "critical" | "exceeded";
  resetAt: string;
}

interface SearchResult {
  smartBlock: SmartBlockResult[];
  apiResults: ApiChannelResults;
  quota?: QuotaStatus;
  keywordInsight?: KeywordInsight | null;
}

interface SmartBlockResult {
  sectionTitle: string;
  posts: SmartBlockPost[];
}

interface SmartBlockPost {
  rank: number | null;
  title: string;
  url: string;
  summary: string;
  isPlace?: boolean;
  isNews?: boolean;
  press?: string;
  date?: string;
}

interface ApiChannelResults {
  blog: ApiResult;
  cafe: ApiResult;
  kin: ApiResult;
  news: ApiResult;
}

interface ApiResult {
  total: number;
  items: ApiItem[];
}

interface ApiItem {
  title: string;
  link: string;
  description: string;
  bloggername?: string;
  cafename?: string;
  originallink?: string;
  pubDate?: string;
  postdate?: string;
}

type ChannelKey = "blog" | "cafe" | "kin" | "news";

interface ChannelPages {
  blog: number;
  cafe: number;
  kin: number;
  news: number;
}

interface ChannelLoadingState {
  blog: boolean;
  cafe: boolean;
  kin: boolean;
  news: boolean;
}

function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(keyword: string) {
  try {
    const recent = getRecentSearches().filter((k) => k !== keyword);
    recent.unshift(keyword);
    localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(recent.slice(0, MAX_RECENT_SEARCHES)),
    );
  } catch {}
}

function removeRecentSearch(keyword: string) {
  try {
    const recent = getRecentSearches().filter((k) => k !== keyword);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent));
  } catch {}
}

function getSavedSearchResults(): SearchResult | null {
  try {
    const stored = sessionStorage.getItem(SEARCH_RESULTS_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveSearchResults(results: SearchResult | null) {
  try {
    if (results) {
      sessionStorage.setItem(SEARCH_RESULTS_KEY, JSON.stringify(results));
    } else {
      sessionStorage.removeItem(SEARCH_RESULTS_KEY);
    }
  } catch {}
}

interface SearchState {
  keyword: string;
  sort: "sim" | "date";
  channelPages: ChannelPages;
  keywordVolume: null;
  highlightTerm: string;
}

function getSavedSearchState(): SearchState | null {
  try {
    const stored = sessionStorage.getItem(SEARCH_STATE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveSearchState(state: SearchState) {
  try {
    sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(state));
  } catch {}
}

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const savedState = getSavedSearchState();
  const savedResults = getSavedSearchResults();

  const [searchResults, setSearchResults] = useState<SearchResult | null>(
    savedResults,
  );
  const [isSearching, setIsSearching] = useState(false);
  const [channelPages, setChannelPages] = useState<ChannelPages>(
    savedState?.channelPages ?? { blog: 1, cafe: 1, kin: 1, news: 1 },
  );
  const [channelLoading, setChannelLoading] = useState<ChannelLoadingState>({
    blog: false,
    cafe: false,
    kin: false,
    news: false,
  });
  const [currentKeyword, setCurrentKeyword] = useState(
    savedState?.keyword ?? "",
  );
  const [currentSort, setCurrentSort] = useState<"sim" | "date">(
    savedState?.sort ?? "sim",
  );
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [highlightTerm, setHighlightTerm] = useState(
    savedState?.highlightTerm ?? "",
  );

  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const channelAbortControllersRef = useRef<
    Record<ChannelKey, AbortController | null>
  >({
    blog: null,
    cafe: null,
    kin: null,
    news: null,
  });

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  useEffect(() => {
    saveSearchResults(searchResults);
  }, [searchResults]);

  useEffect(() => {
    if (currentKeyword) {
      saveSearchState({
        keyword: currentKeyword,
        sort: currentSort,
        channelPages,
        keywordVolume: null,
        highlightTerm,
      });
    }
  }, [currentKeyword, currentSort, channelPages, highlightTerm]);

  const handleSearch = async (keyword: string, sort: "sim" | "date") => {
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    searchAbortControllerRef.current = abortController;

    setIsSearching(true);
    setCurrentKeyword(keyword);
    setCurrentSort(sort);
    setChannelPages({ blog: 1, cafe: 1, kin: 1, news: 1 });

    saveRecentSearch(keyword);
    setRecentSearches(getRecentSearches());

    try {
      const searchResponse = await fetch(
        `/api/search?keyword=${encodeURIComponent(keyword)}&sort=${sort}&page=1`,
        { signal: abortController.signal },
      );
      if (!searchResponse.ok) {
        const errorData = await searchResponse.json().catch(() => ({}));
        throw new Error(errorData.message || "검색 실패");
      }
      const data = await searchResponse.json();

      if (!abortController.signal.aborted) {
        setSearchResults(data);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("Search error:", error);
      const message =
        error instanceof Error ? error.message : "검색 중 오류가 발생했습니다";
      toast({
        title: "검색 실패",
        description: `${message}. 잠시 후 다시 시도해주세요.`,
        variant: "destructive",
      });
    } finally {
      if (!abortController.signal.aborted) {
        setIsSearching(false);
      }
    }
  };

  const handleRecentSearchClick = (keyword: string) => {
    handleSearch(keyword, currentSort);
  };

  const handleRemoveRecentSearch = (keyword: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecentSearch(keyword);
    setRecentSearches(getRecentSearches());
  };

  const exportSearchToCSV = () => {
    if (!searchResults) {
      toast({ title: "내보낼 검색 결과가 없습니다", variant: "destructive" });
      return;
    }

    const rows: string[][] = [
      ["채널", "순위", "제목", "링크", "작성자", "날짜"],
    ];
    const channelNames: Record<string, string> = {
      blog: "블로그",
      cafe: "카페",
      kin: "지식iN",
      news: "뉴스",
    };

    (["blog", "cafe", "kin", "news"] as const).forEach((channel) => {
      const data = searchResults.apiResults[channel];
      data?.items?.forEach((item, idx) => {
        const title = item.title.replace(/<[^>]*>/g, "").replace(/"/g, '""');
        const author = item.bloggername || item.cafename || "-";
        const date = item.postdate || item.pubDate || "-";
        rows.push([
          channelNames[channel],
          String(idx + 1),
          `"${title}"`,
          item.link,
          author,
          date,
        ]);
      });
    });

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `search-${currentKeyword}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({
      title: "CSV 다운로드 완료",
      description: "현재 페이지 결과가 저장되었습니다",
    });
  };

  const handleChannelPageChange = async (
    channel: ChannelKey,
    newPage: number,
  ) => {
    if (!currentKeyword || !searchResults) return;

    if (channelAbortControllersRef.current[channel]) {
      channelAbortControllersRef.current[channel]!.abort();
    }
    const abortController = new AbortController();
    channelAbortControllersRef.current[channel] = abortController;

    const previousPage = channelPages[channel];
    setChannelLoading((prev) => ({ ...prev, [channel]: true }));
    setChannelPages((prev) => ({ ...prev, [channel]: newPage }));

    try {
      const response = await fetch(
        `/api/search/channel?keyword=${encodeURIComponent(currentKeyword)}&channel=${channel}&sort=${currentSort}&page=${newPage}`,
        { signal: abortController.signal },
      );
      if (!response.ok) throw new Error("채널 검색 실패");
      const data = await response.json();

      if (!abortController.signal.aborted) {
        setSearchResults((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            apiResults: {
              ...prev.apiResults,
              [channel]: data.result,
            },
          };
        });
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("Channel search error:", error);
      setChannelPages((prev) => ({ ...prev, [channel]: previousPage }));
      const channelNames: Record<string, string> = {
        blog: "블로그",
        cafe: "카페",
        kin: "지식iN",
        news: "뉴스",
      };
      toast({
        title: `${channelNames[channel]} 페이지 로드 실패`,
        description: "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      if (!abortController.signal.aborted) {
        setChannelLoading((prev) => ({ ...prev, [channel]: false }));
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
          <div className="space-y-4 md:space-y-6">
            <Skeleton className="h-32 md:h-40 w-full rounded-xl" />
            <Skeleton className="h-16 md:h-20 w-full rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
              <Skeleton className="h-72 md:h-96 rounded-xl" />
              <Skeleton className="h-72 md:h-96 rounded-xl hidden md:block" />
              <Skeleton className="h-72 md:h-96 rounded-xl hidden xl:block" />
              <Skeleton className="h-72 md:h-96 rounded-xl hidden xl:block" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
        <div className="space-y-4">
          <SearchPanel onSearch={handleSearch} isSearching={isSearching} />

          {searchResults ? (
            <>
              {searchResults.keywordInsight && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <KeywordInsightCard
                    insight={searchResults.keywordInsight}
                    isLoading={isSearching}
                  />
                  {searchResults.keywordInsight.trend &&
                    searchResults.keywordInsight.trend.length > 0 && (
                      <KeywordTrendChart
                        trend={searchResults.keywordInsight.trend}
                        totalVolume={searchResults.keywordInsight.totalVolume}
                        keyword={searchResults.keywordInsight.keyword}
                        isLoading={isSearching}
                      />
                    )}
                </div>
              )}

              <Card className="p-3 flex items-center gap-2 flex-wrap">
                <Highlighter className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder="브랜드/URL 하이라이트 (2글자 이상)"
                  value={highlightTerm}
                  onChange={(e) => setHighlightTerm(e.target.value)}
                  className="h-9 text-sm max-w-xs"
                />
                {highlightTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2"
                    onClick={() => setHighlightTerm("")}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </Card>

              <SmartBlockSection
                results={searchResults.smartBlock}
                isLoading={isSearching}
                highlightTerm={highlightTerm}
              />
              <ApiResultsSection
                results={searchResults.apiResults}
                smartBlockResults={searchResults.smartBlock}
                channelPages={channelPages}
                channelLoading={channelLoading}
                onChannelPageChange={handleChannelPageChange}
                isLoading={isSearching}
                highlightTerm={highlightTerm}
                onExportCSV={exportSearchToCSV}
              />
            </>
          ) : (
            !isSearching && (
              <Card className="border-dashed">
                <CardContent className="py-12">
                  <div className="text-center space-y-6">
                    <div className="flex justify-center">
                      <div className="p-4 rounded-full bg-primary/5">
                        <Sparkles className="w-10 h-10 text-primary/60" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">
                        검색 결과가 여기에 표시됩니다
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        키워드를 입력하면 블로그, 카페, 지식iN, 뉴스 및
                        스마트블록 결과를
                        <br /> 한눈에 확인할 수 있습니다.
                      </p>
                    </div>

                    {recentSearches.length > 0 && (
                      <div className="pt-4 border-t max-w-md mx-auto">
                        <div className="flex items-center justify-center gap-2 mb-3 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>최근 검색어</span>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2">
                          {recentSearches.map((keyword) => (
                            <Badge
                              key={keyword}
                              variant="secondary"
                              className="cursor-pointer hover:bg-secondary/80 transition-colors group pr-1"
                              onClick={() => handleRecentSearchClick(keyword)}
                            >
                              {keyword}
                              <button
                                onClick={(e) =>
                                  handleRemoveRecentSearch(keyword, e)
                                }
                                className="ml-1.5 p-0.5 rounded-full hover:bg-muted-foreground/20"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-lg mx-auto pt-4">
                      <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/30">
                        <FileText className="w-5 h-5 text-green-500" />
                        <span className="text-xs text-muted-foreground">
                          블로그
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/30">
                        <MessageSquare className="w-5 h-5 text-orange-500" />
                        <span className="text-xs text-muted-foreground">
                          카페
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/30">
                        <HelpCircle className="w-5 h-5 text-blue-500" />
                        <span className="text-xs text-muted-foreground">
                          지식iN
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/30">
                        <Newspaper className="w-5 h-5 text-purple-500" />
                        <span className="text-xs text-muted-foreground">
                          뉴스
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </main>
    </div>
  );
}
