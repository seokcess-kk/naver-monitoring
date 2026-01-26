import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sanitizeHtml } from "@/lib/sanitize";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Server,
  BookOpen,
  Coffee,
  GraduationCap,
  Newspaper,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Check,
  Loader2,
  Download,
} from "lucide-react";

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

interface ApiResult {
  total: number;
  items: ApiItem[];
}

interface ApiChannelResults {
  blog: ApiResult;
  cafe: ApiResult;
  kin: ApiResult;
  news: ApiResult;
}

interface SmartBlockPost {
  rank: number | null;
  title: string;
  url: string;
  summary: string;
  isPlace?: boolean;
  isNews?: boolean;
}

interface SmartBlockResult {
  sectionTitle: string;
  posts: SmartBlockPost[];
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

interface ApiResultsSectionProps {
  results: ApiChannelResults;
  smartBlockResults: SmartBlockResult[];
  channelPages: ChannelPages;
  channelLoading: ChannelLoadingState;
  onChannelPageChange: (channel: ChannelKey, page: number) => void;
  isLoading: boolean;
  highlightTerm?: string;
  onExportCSV?: () => void;
}

interface ChannelConfig {
  key: ChannelKey;
  title: string;
  shortTitle: string;
  icon: React.ReactNode;
  headerClass: string;
  badgeClass: string;
  tabClass: string;
  getName: (item: ApiItem) => string | undefined;
}

const channels: ChannelConfig[] = [
  {
    key: "blog",
    title: "블로그",
    shortTitle: "블로그",
    icon: <BookOpen className="w-4 h-4" />,
    headerClass: "bg-emerald-500/10",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    tabClass: "data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600",
    getName: (item) => item.bloggername,
  },
  {
    key: "cafe",
    title: "카페",
    shortTitle: "카페",
    icon: <Coffee className="w-4 h-4" />,
    headerClass: "bg-orange-500/10",
    badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
    tabClass: "data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-600",
    getName: (item) => item.cafename,
  },
  {
    key: "kin",
    title: "지식iN",
    shortTitle: "지식iN",
    icon: <GraduationCap className="w-4 h-4" />,
    headerClass: "bg-blue-500/10",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    tabClass: "data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600",
    getName: () => undefined,
  },
  {
    key: "news",
    title: "뉴스",
    shortTitle: "뉴스",
    icon: <Newspaper className="w-4 h-4" />,
    headerClass: "bg-purple-500/10",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    tabClass: "data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-600",
    getName: () => undefined,
  },
];

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.origin + parsed.pathname;
  } catch {
    return url.split("?")[0];
  }
}

function formatDate(dateStr?: string): string | null {
  if (!dateStr) return null;

  if (/^\d{8}$/.test(dateStr)) {
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    return `${year}.${month}.${day}`;
  }

  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
    }
  } catch {}

  return null;
}

function getSectionChannel(sectionTitle: string, postUrl: string): ChannelKey | null {
  const title = sectionTitle.toLowerCase();
  const url = postUrl.toLowerCase();
  
  if (title.includes("뉴스") || title.includes("news")) {
    return "news";
  }
  
  if (title.includes("지식") || title.includes("kin")) {
    return "kin";
  }
  
  if (title.includes("카페") || title.includes("cafe")) {
    return "cafe";
  }
  
  if (
    title.includes("인플루언서") ||
    title.includes("브랜드") ||
    title.includes("블로그") ||
    title.includes("influencer") ||
    title.includes("ugc")
  ) {
    return "blog";
  }
  
  if (url.includes("blog.naver.com") || url.includes("m.blog.naver.com")) {
    return "blog";
  }
  if (url.includes("cafe.naver.com") || url.includes("m.cafe.naver.com")) {
    return "cafe";
  }
  if (url.includes("kin.naver.com") || url.includes("m.kin.naver.com")) {
    return "kin";
  }
  if (url.includes("news.naver.com") || url.includes("n.news.naver.com")) {
    return "news";
  }
  
  return null;
}

type ChannelUrlSets = Record<ChannelKey, Set<string>>;

function createChannelSmartBlockUrlSets(smartBlockResults: SmartBlockResult[]): ChannelUrlSets {
  const urlSets: ChannelUrlSets = {
    blog: new Set<string>(),
    cafe: new Set<string>(),
    kin: new Set<string>(),
    news: new Set<string>(),
  };
  
  for (const section of smartBlockResults) {
    for (const post of section.posts) {
      const channel = getSectionChannel(section.sectionTitle, post.url);
      if (channel) {
        urlSets[channel].add(normalizeUrl(post.url));
      }
    }
  }
  
  return urlSets;
}

function ChannelCard({
  channel,
  channelData,
  currentPage,
  maxPage,
  isChannelLoading,
  smartBlockUrlSet,
  onPageChange,
  highlightTerm,
  highlightRegex,
}: {
  channel: ChannelConfig;
  channelData: ApiResult;
  currentPage: number;
  maxPage: number;
  isChannelLoading: boolean;
  smartBlockUrlSet: Set<string>;
  onPageChange: (page: number) => void;
  highlightTerm?: string;
  highlightRegex: RegExp | null;
}) {
  const applyHighlight = (html: string): string => {
    if (!highlightRegex) return html;
    return html.replace(highlightRegex, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">$1</mark>');
  };

  return (
    <Card className="flex flex-col overflow-hidden border-border/50 shadow-sm hover-lift">
      <CardHeader className={`pb-3 ${channel.headerClass} border-b border-border/30`}>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            {channel.icon}
            {channel.title}
          </CardTitle>
          <Badge variant="outline" className={`text-[10px] font-semibold ${channel.badgeClass}`}>
            총 {channelData?.total?.toLocaleString() || 0}건
          </Badge>
        </div>
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isChannelLoading}
            data-testid={`button-prev-page-${channel.key}`}
            aria-label="이전 페이지"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">이전 페이지</span>
          </Button>
          <span className="text-xs font-medium text-muted-foreground" aria-live="polite">
            {isChannelLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-label="로딩 중" />
            ) : (
              <>
                <span className="text-foreground font-bold">{currentPage}</span>
                <span className="mx-1">/</span>
                <span>{maxPage || 1}</span>
              </>
            )}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= maxPage || isChannelLoading}
            data-testid={`button-next-page-${channel.key}`}
            aria-label="다음 페이지"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">다음 페이지</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 relative">
        {isChannelLoading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <ScrollArea className="h-[320px] md:h-[420px]">
          <div className="p-3 space-y-2">
            {channelData?.items?.map((item, idx) => {
              const isMatched = smartBlockUrlSet.has(normalizeUrl(item.link));
              const displayRank = (currentPage - 1) * 10 + idx + 1;

              return (
                <a
                  key={idx}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group block p-2.5 md:p-3 rounded-lg transition-all duration-200 ${
                    isMatched
                      ? "bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/15 hover:border-emerald-500/50"
                      : "hover:bg-muted/60 border border-transparent"
                  }`}
                  data-testid={`link-api-item-${channel.key}-${idx}`}
                >
                  <div className="flex items-start gap-2.5 md:gap-3">
                    <div
                      className={`w-6 h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center text-[10px] md:text-xs font-bold shrink-0 ${
                        isMatched
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {displayRank}
                    </div>
                    <div className="flex-1 min-w-0">
                      {isMatched && (
                        <Badge className="mb-1 md:mb-1.5 text-[9px] md:text-[10px] bg-emerald-500 hover:bg-emerald-500 text-white">
                          <Check className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5 md:mr-1" />
                          스마트블록 매칭
                        </Badge>
                      )}
                      <div className="flex items-center gap-2">
                        <h4
                          className="text-xs md:text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(highlightTerm ? applyHighlight(item.title) : item.title) }}
                        />
                        <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                      {item.description && (
                        <p
                          className="text-[10px] md:text-xs text-muted-foreground/80 line-clamp-2 mt-1 md:mt-1.5 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.description) }}
                        />
                      )}
                      {(channel.getName(item) || item.postdate || item.pubDate) && (
                        <p className="text-[10px] md:text-[11px] text-muted-foreground/70 mt-1.5 md:mt-2 flex items-center gap-1 md:gap-1.5 flex-wrap">
                          {channel.getName(item) && (
                            <span className="font-medium">{channel.getName(item)}</span>
                          )}
                          {channel.getName(item) && (item.postdate || item.pubDate) && <span>·</span>}
                          {formatDate(item.postdate || item.pubDate) && (
                            <span>{formatDate(item.postdate || item.pubDate)}</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </a>
              );
            })}
            {(!channelData?.items || channelData.items.length === 0) && (
              <div className="py-8 md:py-12 text-center">
                <p className="text-xs md:text-sm text-muted-foreground mb-1.5 md:mb-2">
                  검색 결과가 없습니다
                </p>
                <p className="text-[10px] md:text-xs text-muted-foreground/70">
                  다른 키워드나 정렬 옵션을 시도해보세요
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export function ApiResultsSection({
  results,
  smartBlockResults,
  channelPages,
  channelLoading,
  onChannelPageChange,
  isLoading,
  highlightTerm,
  onExportCSV,
}: ApiResultsSectionProps) {
  const [activeTab, setActiveTab] = useState<ChannelKey>("blog");

  const channelUrlSets = useMemo(
    () => createChannelSmartBlockUrlSets(smartBlockResults),
    [smartBlockResults]
  );

  const highlightRegex = useMemo(() => {
    if (!highlightTerm || highlightTerm.trim().length < 2) return null;
    const escapedTerm = highlightTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(${escapedTerm})`, 'gi');
  }, [highlightTerm]);

  if (isLoading) {
    return (
      <section className="space-y-4 md:space-y-6 mt-6 md:mt-10">
        <div className="flex items-center gap-3 md:gap-4 pb-3 md:pb-4 border-b border-border/50">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center">
            <Server className="w-4 h-4 md:w-5 md:h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight">채널별 상세 순위</h2>
            <p className="text-xs md:text-sm text-muted-foreground">API 데이터를 불러오는 중...</p>
          </div>
        </div>
        <div className="md:hidden">
          <Skeleton className="h-10 w-full rounded-lg mb-4" />
          <Skeleton className="h-[380px] rounded-xl" />
        </div>
        <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[480px] md:h-[520px] rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 md:space-y-6 mt-6 md:mt-10 animate-fade-in">
      <div className="flex items-center justify-between gap-3 md:gap-4 pb-3 md:pb-4 border-b border-border/50">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center">
            <Server className="w-4 h-4 md:w-5 md:h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight">채널별 상세 순위</h2>
            <p className="text-xs md:text-sm text-muted-foreground">
              블로그, 카페, 지식iN, 뉴스 각 채널별 노출 현황
            </p>
          </div>
        </div>
        {onExportCSV && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onExportCSV} 
            className="shrink-0"
            title="현재 페이지 결과만 내보냅니다"
          >
            <Download className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">현재 페이지 CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>
        )}
      </div>

      <div className="md:hidden">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ChannelKey)}>
          <TabsList className="grid w-full grid-cols-4 mb-4">
            {channels.map((channel) => (
              <TabsTrigger
                key={channel.key}
                value={channel.key}
                className={`text-xs gap-1 px-2 ${channel.tabClass}`}
              >
                {channel.icon}
                <span className="hidden xs:inline">{channel.shortTitle}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {channels.map((channel) => {
            const channelData = results[channel.key];
            const currentPage = channelPages[channel.key];
            const isChannelLoading = channelLoading[channel.key];
            const maxPage = Math.ceil((channelData?.total || 0) / 10);

            return (
              <TabsContent key={channel.key} value={channel.key} className="mt-0">
                <ChannelCard
                  channel={channel}
                  channelData={channelData}
                  currentPage={currentPage}
                  maxPage={maxPage}
                  isChannelLoading={isChannelLoading}
                  smartBlockUrlSet={channelUrlSets[channel.key]}
                  onPageChange={(page) => onChannelPageChange(channel.key, page)}
                  highlightTerm={highlightTerm}
                  highlightRegex={highlightRegex}
                />
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
        {channels.map((channel) => {
          const channelData = results[channel.key];
          const currentPage = channelPages[channel.key];
          const isChannelLoading = channelLoading[channel.key];
          const maxPage = Math.ceil((channelData?.total || 0) / 10);

          return (
            <ChannelCard
              key={channel.key}
              channel={channel}
              channelData={channelData}
              currentPage={currentPage}
              maxPage={maxPage}
              isChannelLoading={isChannelLoading}
              smartBlockUrlSet={channelUrlSets[channel.key]}
              onPageChange={(page) => onChannelPageChange(channel.key, page)}
              highlightTerm={highlightTerm}
              highlightRegex={highlightRegex}
            />
          );
        })}
      </div>
    </section>
  );
}
