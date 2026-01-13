import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
}

interface ChannelConfig {
  key: ChannelKey;
  title: string;
  icon: React.ReactNode;
  headerClass: string;
  badgeClass: string;
  getName: (item: ApiItem) => string | undefined;
}

const channels: ChannelConfig[] = [
  {
    key: "blog",
    title: "블로그",
    icon: <BookOpen className="w-4 h-4" />,
    headerClass: "bg-emerald-500/10",
    badgeClass:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    getName: (item) => item.bloggername,
  },
  {
    key: "cafe",
    title: "카페",
    icon: <Coffee className="w-4 h-4" />,
    headerClass: "bg-orange-500/10",
    badgeClass:
      "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
    getName: (item) => item.cafename,
  },
  {
    key: "kin",
    title: "지식iN",
    icon: <GraduationCap className="w-4 h-4" />,
    headerClass: "bg-blue-500/10",
    badgeClass:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    getName: () => undefined,
  },
  {
    key: "news",
    title: "뉴스",
    icon: <Newspaper className="w-4 h-4" />,
    headerClass: "bg-purple-500/10",
    badgeClass:
      "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
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

function checkIfMatched(
  itemUrl: string,
  smartBlockResults: SmartBlockResult[],
): boolean {
  for (const section of smartBlockResults) {
    for (const post of section.posts) {
      if (isUrlMatch(itemUrl, post.url)) {
        return true;
      }
    }
  }
  return false;
}

export function ApiResultsSection({
  results,
  smartBlockResults,
  channelPages,
  channelLoading,
  onChannelPageChange,
  isLoading,
}: ApiResultsSectionProps) {
  if (isLoading) {
    return (
      <section className="space-y-6 mt-10">
        <div className="flex items-center gap-4 pb-4 border-b border-border/50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center">
            <Server className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              채널별 상세 순위
            </h2>
            <p className="text-sm text-muted-foreground">
              API 데이터를 불러오는 중...
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[520px] rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 mt-10">
      <div className="flex items-center gap-4 pb-4 border-b border-border/50">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center">
          <Server className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">채널별 상세 순위</h2>
          <p className="text-sm text-muted-foreground">
            블로그, 카페, 지식iN, 뉴스 각 채널별 노출 현황
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {channels.map((channel) => {
          const channelData = results[channel.key];
          const currentPage = channelPages[channel.key];
          const isChannelLoading = channelLoading[channel.key];
          const maxPage = Math.ceil((channelData?.total || 0) / 10);

          return (
            <Card
              key={channel.key}
              className="flex flex-col overflow-hidden border-border/50 shadow-sm"
            >
              <CardHeader
                className={`pb-3 ${channel.headerClass} border-b border-border/30`}
              >
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    {channel.icon}
                    {channel.title}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-semibold ${channel.badgeClass}`}
                  >
                    총 {channelData?.total?.toLocaleString() || 0}건
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() =>
                      onChannelPageChange(channel.key, currentPage - 1)
                    }
                    disabled={currentPage <= 1 || isChannelLoading}
                    data-testid={`button-prev-page-${channel.key}`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-medium text-muted-foreground">
                    {isChannelLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span className="text-foreground font-bold">
                          {currentPage}
                        </span>
                        <span className="mx-1">/</span>
                        <span>{maxPage || 1}</span>
                      </>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() =>
                      onChannelPageChange(channel.key, currentPage + 1)
                    }
                    disabled={currentPage >= maxPage || isChannelLoading}
                    data-testid={`button-next-page-${channel.key}`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0 relative">
                {isChannelLoading && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                <ScrollArea className="h-[420px]">
                  <div className="p-3 space-y-2">
                    {channelData?.items?.map((item, idx) => {
                      const isMatched = checkIfMatched(
                        item.link,
                        smartBlockResults,
                      );
                      const displayRank = (currentPage - 1) * 10 + idx + 1;

                      return (
                        <a
                          key={idx}
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`group block p-3 rounded-lg transition-all duration-200 ${
                            isMatched
                              ? "bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/15 hover:border-emerald-500/50"
                              : "hover:bg-muted/60 border border-transparent"
                          }`}
                          data-testid={`link-api-item-${channel.key}-${idx}`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                                isMatched
                                  ? "bg-emerald-500 text-white"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {displayRank}
                            </div>
                            <div className="flex-1 min-w-0">
                              {isMatched && (
                                <Badge className="mb-1.5 text-[10px] bg-emerald-500 hover:bg-emerald-500 text-white">
                                  <Check className="w-3 h-3 mr-1" />
                                  스마트블록 매칭
                                </Badge>
                              )}
                              <div className="flex items-center gap-2">
                                <h4
                                  className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors"
                                  dangerouslySetInnerHTML={{
                                    __html: item.title,
                                  }}
                                />
                                <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                              </div>
                              {item.description && (
                                <p
                                  className="text-xs text-muted-foreground/80 line-clamp-2 mt-1.5 leading-relaxed"
                                  dangerouslySetInnerHTML={{
                                    __html: item.description,
                                  }}
                                />
                              )}
                              {(channel.getName(item) ||
                                item.postdate ||
                                item.pubDate) && (
                                <p className="text-[11px] text-muted-foreground/70 mt-2 flex items-center gap-1.5 flex-wrap">
                                  {channel.getName(item) && (
                                    <span className="font-medium">
                                      {channel.getName(item)}
                                    </span>
                                  )}
                                  {channel.getName(item) &&
                                    (item.postdate || item.pubDate) && (
                                      <span>·</span>
                                    )}
                                  {formatDate(
                                    item.postdate || item.pubDate,
                                  ) && (
                                    <span>
                                      {formatDate(
                                        item.postdate || item.pubDate,
                                      )}
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                          </div>
                        </a>
                      );
                    })}
                    {(!channelData?.items ||
                      channelData.items.length === 0) && (
                      <div className="py-16 text-center text-muted-foreground text-sm">
                        검색 결과가 없습니다
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
