import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
}

function highlightText(html: string, term: string): string {
  if (!term || term.trim().length < 2) return html;
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedTerm})`, 'gi');
  return html.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">$1</mark>');
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

function isUrlMatch(url1: string, url2: string): boolean {
  return normalizeUrl(url1) === normalizeUrl(url2);
}

function checkIfMatched(itemUrl: string, smartBlockResults: SmartBlockResult[]): boolean {
  for (const section of smartBlockResults) {
    for (const post of section.posts) {
      if (isUrlMatch(itemUrl, post.url)) {
        return true;
      }
    }
  }
  return false;
}

function ChannelCard({
  channel,
  channelData,
  currentPage,
  maxPage,
  isChannelLoading,
  smartBlockResults,
  onPageChange,
  highlightTerm,
}: {
  channel: ChannelConfig;
  channelData: ApiResult;
  currentPage: number;
  maxPage: number;
  isChannelLoading: boolean;
  smartBlockResults: SmartBlockResult[];
  onPageChange: (page: number) => void;
  highlightTerm?: string;
}) {
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
              const isMatched = checkIfMatched(item.link, smartBlockResults);
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
                          dangerouslySetInnerHTML={{ __html: highlightTerm ? highlightText(item.title, highlightTerm) : item.title }}
                        />
                        <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                      {item.description && (
                        <p
                          className="text-[10px] md:text-xs text-muted-foreground/80 line-clamp-2 mt-1 md:mt-1.5 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: item.description }}
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
}: ApiResultsSectionProps) {
  const [activeTab, setActiveTab] = useState<ChannelKey>("blog");

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
      <div className="flex items-center gap-3 md:gap-4 pb-3 md:pb-4 border-b border-border/50">
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
                  smartBlockResults={smartBlockResults}
                  onPageChange={(page) => onChannelPageChange(channel.key, page)}
                  highlightTerm={highlightTerm}
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
              smartBlockResults={smartBlockResults}
              onPageChange={(page) => onChannelPageChange(channel.key, page)}
              highlightTerm={highlightTerm}
            />
          );
        })}
      </div>
    </section>
  );
}
