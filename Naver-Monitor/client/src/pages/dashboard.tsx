import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { SearchPanel } from "@/components/search-panel";
import { SmartBlockSection } from "@/components/smart-block-section";
import { ApiResultsSection } from "@/components/api-results-section";
import { ApiKeySetup } from "@/components/api-key-setup";
import { SovPanel } from "@/components/sov-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Search, BarChart3, Monitor, Smartphone, TrendingUp } from "lucide-react";
import type { ApiKeyPublic } from "@shared/schema";

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

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
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

  const { data: apiKey, isLoading: apiKeyLoading, refetch: refetchApiKey } = useQuery<ApiKeyPublic>({
    queryKey: ["/api/api-keys"],
    enabled: !!user,
  });

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
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="space-y-6">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <Skeleton className="h-96 rounded-xl" />
              <Skeleton className="h-96 rounded-xl" />
              <Skeleton className="h-96 rounded-xl" />
              <Skeleton className="h-96 rounded-xl" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="space-y-8">
          <ApiKeySetup 
            existingApiKey={apiKey} 
            onSave={() => refetchApiKey()} 
          />

          {apiKey?.hasClientSecret && (
            <Tabs defaultValue="search" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="search" className="gap-2" data-testid="tab-search">
                  <Search className="w-4 h-4" />
                  통합 검색
                </TabsTrigger>
                <TabsTrigger value="sov" className="gap-2" data-testid="tab-sov">
                  <BarChart3 className="w-4 h-4" />
                  SOV 분석
                </TabsTrigger>
              </TabsList>

              <TabsContent value="search" className="space-y-8">
                <SearchPanel 
                  onSearch={handleSearch} 
                  isSearching={isSearching}
                  hasApiKey={!!apiKey.hasClientSecret}
                />

                {currentKeyword && (
                  <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-background">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <TrendingUp className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-lg">{currentKeyword}</p>
                            <p className="text-xs text-muted-foreground">최근 30일 검색량</p>
                          </div>
                        </div>
                        
                        {isLoadingVolume ? (
                          <div className="flex gap-6">
                            <Skeleton className="h-12 w-24" />
                            <Skeleton className="h-12 w-24" />
                          </div>
                        ) : keywordVolume?.available ? (
                          <div className="flex gap-6">
                            <div className="text-center px-4 py-2 rounded-lg bg-background border">
                              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <Monitor className="w-4 h-4" />
                                <span className="text-xs font-medium">PC</span>
                              </div>
                              <p className="text-xl font-bold text-foreground">
                                {keywordVolume.monthlyPcQcCnt?.toLocaleString() ?? "-"}
                              </p>
                            </div>
                            <div className="text-center px-4 py-2 rounded-lg bg-background border">
                              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <Smartphone className="w-4 h-4" />
                                <span className="text-xs font-medium">Mobile</span>
                              </div>
                              <p className="text-xl font-bold text-foreground">
                                {keywordVolume.monthlyMobileQcCnt?.toLocaleString() ?? "-"}
                              </p>
                            </div>
                          </div>
                        ) : keywordVolume?.error ? (
                          <div className="text-center">
                            <p className="text-sm text-destructive">검색량 조회 실패</p>
                            <p className="text-xs text-muted-foreground mt-1">잠시 후 다시 시도해주세요</p>
                          </div>
                        ) : keywordVolume?.configured === false ? (
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">검색량 API 미설정</p>
                            <a 
                              href="https://searchad.naver.com" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline mt-1 inline-block"
                            >
                              네이버 광고 API 설정하기 →
                            </a>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">검색량 데이터 없음</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {searchResults && (
                  <>
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
                    />
                  </>
                )}
              </TabsContent>

              <TabsContent value="sov">
                <SovPanel />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </div>
  );
}
