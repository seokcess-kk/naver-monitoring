import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { SearchPanel } from "@/components/search-panel";
import { SmartBlockSection } from "@/components/smart-block-section";
import { ApiResultsSection } from "@/components/api-results-section";
import { ApiKeySetup } from "@/components/api-key-setup";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Search, Monitor, Smartphone, TrendingUp, Clock, Sparkles, FileText, MessageSquare, HelpCircle, Newspaper, X, Highlighter, Download } from "lucide-react";
import type { ApiKeyPublic } from "@shared/schema";

const RECENT_SEARCHES_KEY = "search-scope-recent-searches";
const MAX_RECENT_SEARCHES = 5;

interface KeywordVolumeData {
  keyword: string;
  monthlyPcQcCnt: number | null;
  monthlyMobileQcCnt: number | null;
  available: boolean;
  configured?: boolean;
  error?: boolean;
}

interface SearchResult {
  smartBlock: SmartBlockResult[];
  apiResults: ApiChannelResults;
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
    const recent = getRecentSearches().filter(k => k !== keyword);
    recent.unshift(keyword);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_SEARCHES)));
  } catch {}
}

function removeRecentSearch(keyword: string) {
  try {
    const recent = getRecentSearches().filter(k => k !== keyword);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent));
  } catch {}
}

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [channelPages, setChannelPages] = useState<ChannelPages>({
    blog: 1,
    cafe: 1,
    kin: 1,
    news: 1,
  });
  const [channelLoading, setChannelLoading] = useState<ChannelLoadingState>({
    blog: false,
    cafe: false,
    kin: false,
    news: false,
  });
  const [currentKeyword, setCurrentKeyword] = useState("");
  const [currentSort, setCurrentSort] = useState<"sim" | "date">("sim");
  const [keywordVolume, setKeywordVolume] = useState<KeywordVolumeData | null>(null);
  const [isLoadingVolume, setIsLoadingVolume] = useState(false);
  const [apiKeySetupOpen, setApiKeySetupOpen] = useState<boolean | undefined>(undefined);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [highlightTerm, setHighlightTerm] = useState("");

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

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

  const fetchKeywordVolume = async (keyword: string) => {
    setIsLoadingVolume(true);
    try {
      const response = await fetch(`/api/keyword-volume?keyword=${encodeURIComponent(keyword)}`);
      if (response.ok) {
        const data = await response.json();
        setKeywordVolume(data);
      } else {
        setKeywordVolume({ keyword, monthlyPcQcCnt: null, monthlyMobileQcCnt: null, available: false, error: true });
      }
    } catch (error) {
      console.error("Keyword volume fetch error:", error);
      setKeywordVolume({ keyword, monthlyPcQcCnt: null, monthlyMobileQcCnt: null, available: false, error: true });
    } finally {
      setIsLoadingVolume(false);
    }
  };

  const handleSearch = async (keyword: string, sort: "sim" | "date") => {
    if (!apiKey?.hasClientSecret) return;
    
    setIsSearching(true);
    setCurrentKeyword(keyword);
    setCurrentSort(sort);
    setChannelPages({ blog: 1, cafe: 1, kin: 1, news: 1 });
    setKeywordVolume(null);

    saveRecentSearch(keyword);
    setRecentSearches(getRecentSearches());

    try {
      const searchResponse = await fetch(`/api/search?keyword=${encodeURIComponent(keyword)}&sort=${sort}&page=1`);
      if (!searchResponse.ok) throw new Error("검색 실패");
      const data = await searchResponse.json();
      setSearchResults(data);
      
      fetchKeywordVolume(keyword);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
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

    const rows: string[][] = [["채널", "순위", "제목", "링크", "작성자", "날짜"]];
    const channelNames: Record<string, string> = { blog: "블로그", cafe: "카페", kin: "지식iN", news: "뉴스" };

    (["blog", "cafe", "kin", "news"] as const).forEach(channel => {
      const data = searchResults.apiResults[channel];
      data?.items?.forEach((item, idx) => {
        const title = item.title.replace(/<[^>]*>/g, "").replace(/"/g, '""');
        const author = item.bloggername || item.cafename || "-";
        const date = item.postdate || item.pubDate || "-";
        rows.push([channelNames[channel], String(idx + 1), `"${title}"`, item.link, author, date]);
      });
    });

    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `search-${currentKeyword}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV 다운로드 완료" });
  };

  const handleChannelPageChange = async (channel: ChannelKey, newPage: number) => {
    if (!currentKeyword || !searchResults) return;

    const previousPage = channelPages[channel];
    setChannelLoading(prev => ({ ...prev, [channel]: true }));
    setChannelPages(prev => ({ ...prev, [channel]: newPage }));

    try {
      const response = await fetch(
        `/api/search/channel?keyword=${encodeURIComponent(currentKeyword)}&channel=${channel}&sort=${currentSort}&page=${newPage}`
      );
      if (!response.ok) throw new Error("채널 검색 실패");
      const data = await response.json();
      
      setSearchResults(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          apiResults: {
            ...prev.apiResults,
            [channel]: data.result,
          },
        };
      });
    } catch (error) {
      console.error("Channel search error:", error);
      setChannelPages(prev => ({ ...prev, [channel]: previousPage }));
    } finally {
      setChannelLoading(prev => ({ ...prev, [channel]: false }));
    }
  };

  if (authLoading || apiKeyLoading) {
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
        <div className="space-y-6 md:space-y-8">
          <ApiKeySetup 
            existingApiKey={apiKey} 
            onSave={() => refetchApiKey()}
            isOpen={apiKeySetupOpen}
            onOpenChange={setApiKeySetupOpen}
          />

          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Search className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">통합검색</h1>
              <p className="text-sm text-muted-foreground">네이버 검색 결과를 한눈에 확인하세요</p>
            </div>
          </div>

          <div className="space-y-4 md:space-y-8">
            <SearchPanel 
                onSearch={handleSearch} 
                isSearching={isSearching}
                hasApiKey={hasApiKey}
                onOpenApiKeySetup={() => setApiKeySetupOpen(true)}
              />

                {currentKeyword && (
                  <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-background glass-card animate-scale-in">
                    <CardContent className="py-3 md:py-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
                            <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-base md:text-lg">{currentKeyword}</p>
                            <p className="text-[10px] md:text-xs text-muted-foreground">최근 30일 검색량</p>
                          </div>
                        </div>
                        
                        {isLoadingVolume ? (
                          <div className="flex gap-3 md:gap-6">
                            <Skeleton className="h-10 md:h-12 w-20 md:w-24" />
                            <Skeleton className="h-10 md:h-12 w-20 md:w-24" />
                          </div>
                        ) : keywordVolume?.available ? (
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex gap-3 md:gap-6">
                              <div className="text-center px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-background border flex-1 sm:flex-initial">
                                <div className="flex items-center justify-center gap-1.5 md:gap-2 text-muted-foreground mb-0.5 md:mb-1">
                                  <Monitor className="w-3 h-3 md:w-4 md:h-4" />
                                  <span className="text-[10px] md:text-xs font-medium">PC</span>
                                </div>
                                <p className="text-lg md:text-xl font-bold text-foreground">
                                  {keywordVolume.monthlyPcQcCnt?.toLocaleString() ?? "-"}
                                </p>
                              </div>
                              <div className="text-center px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-background border flex-1 sm:flex-initial">
                                <div className="flex items-center justify-center gap-1.5 md:gap-2 text-muted-foreground mb-0.5 md:mb-1">
                                  <Smartphone className="w-3 h-3 md:w-4 md:h-4" />
                                  <span className="text-[10px] md:text-xs font-medium">Mobile</span>
                                </div>
                                <p className="text-lg md:text-xl font-bold text-foreground">
                                  {keywordVolume.monthlyMobileQcCnt?.toLocaleString() ?? "-"}
                                </p>
                              </div>
                            </div>
                            <p className="text-[9px] md:text-[10px] text-muted-foreground/70">
                              출처: 네이버 광고 API
                            </p>
                          </div>
                        ) : keywordVolume?.error ? (
                          <div className="text-center sm:text-right flex flex-col items-end gap-1.5">
                            <p className="text-xs md:text-sm text-destructive">검색량 조회 실패</p>
                            <button
                              type="button"
                              onClick={() => fetchKeywordVolume(currentKeyword)}
                              className="text-[10px] md:text-xs text-primary hover:underline"
                            >
                              다시 시도 →
                            </button>
                          </div>
                        ) : keywordVolume?.configured === false ? (
                          <div className="text-center sm:text-right">
                            <p className="text-xs md:text-sm text-muted-foreground">검색량 API 미설정</p>
                            <a 
                              href="https://searchad.naver.com" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[10px] md:text-xs text-primary hover:underline mt-0.5 inline-block"
                            >
                              네이버 광고 API 설정하기 →
                            </a>
                          </div>
                        ) : (
                          <p className="text-xs md:text-sm text-muted-foreground">검색량 데이터 없음</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {searchResults ? (
                  <>
                    <Card className="p-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                        <Highlighter className="w-4 h-4 text-muted-foreground shrink-0" />
                        <Input
                          placeholder="브랜드/URL 하이라이트 (2글자 이상)"
                          value={highlightTerm}
                          onChange={(e) => setHighlightTerm(e.target.value)}
                          className="h-9 text-sm max-w-xs"
                        />
                        {highlightTerm && (
                          <Button variant="ghost" size="sm" className="h-9 px-2" onClick={() => setHighlightTerm("")}>
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <Button variant="outline" size="sm" onClick={exportSearchToCSV}>
                        <Download className="w-4 h-4 mr-2" />
                        CSV 내보내기
                      </Button>
                    </Card>
                    <SmartBlockSection 
                      results={searchResults.smartBlock} 
                      isLoading={isSearching}
                    />
                    <ApiResultsSection 
                      results={searchResults.apiResults}
                      smartBlockResults={searchResults.smartBlock}
                      channelPages={channelPages}
                      channelLoading={channelLoading}
                      onChannelPageChange={handleChannelPageChange}
                      isLoading={isSearching}
                      highlightTerm={highlightTerm}
                    />
                  </>
                ) : !isSearching && hasApiKey && (
                  <Card className="border-dashed">
                    <CardContent className="py-12">
                      <div className="text-center space-y-6">
                        <div className="flex justify-center">
                          <div className="p-4 rounded-full bg-primary/5">
                            <Sparkles className="w-10 h-10 text-primary/60" />
                          </div>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold mb-2">검색 결과가 여기에 표시됩니다</h3>
                          <p className="text-sm text-muted-foreground max-w-md mx-auto">
                            키워드를 입력하면 블로그, 카페, 지식iN, 뉴스 및 스마트블록 결과를 한눈에 확인할 수 있습니다.
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
                                    onClick={(e) => handleRemoveRecentSearch(keyword, e)}
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
                            <span className="text-xs text-muted-foreground">블로그</span>
                          </div>
                          <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/30">
                            <MessageSquare className="w-5 h-5 text-orange-500" />
                            <span className="text-xs text-muted-foreground">카페</span>
                          </div>
                          <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/30">
                            <HelpCircle className="w-5 h-5 text-blue-500" />
                            <span className="text-xs text-muted-foreground">지식iN</span>
                          </div>
                          <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/30">
                            <Newspaper className="w-5 h-5 text-purple-500" />
                            <span className="text-xs text-muted-foreground">뉴스</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
          </div>
        </div>
      </main>
    </div>
  );
}
