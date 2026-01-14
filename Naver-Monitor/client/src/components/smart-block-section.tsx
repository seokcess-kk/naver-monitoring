import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Layers,
  MapPin,
  Newspaper,
  FileText,
  ExternalLink,
  Zap,
} from "lucide-react";

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

interface SmartBlockResult {
  sectionTitle: string;
  posts: SmartBlockPost[];
}

interface SmartBlockSectionProps {
  results: SmartBlockResult[];
  isLoading: boolean;
}

function getSectionIcon(title: string) {
  if (title.includes("플레이스") || title.includes("지도")) {
    return <MapPin className="w-4 h-4" />;
  }
  if (title.includes("뉴스")) {
    return <Newspaper className="w-4 h-4" />;
  }
  return <FileText className="w-4 h-4" />;
}

function getSectionStyle(title: string): {
  bg: string;
  text: string;
  border: string;
} {
  if (title.includes("플레이스") || title.includes("지도")) {
    return {
      bg: "bg-rose-500/10",
      text: "text-rose-600 dark:text-rose-400",
      border: "border-rose-500/20",
    };
  }
  if (title.includes("뉴스")) {
    return {
      bg: "bg-sky-500/10",
      text: "text-sky-600 dark:text-sky-400",
      border: "border-sky-500/20",
    };
  }
  return {
    bg: "bg-violet-500/10",
    text: "text-violet-600 dark:text-violet-400",
    border: "border-violet-500/20",
  };
}

export function SmartBlockSection({
  results,
  isLoading,
}: SmartBlockSectionProps) {
  if (isLoading) {
    return (
      <section className="space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-border/50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 flex items-center justify-center">
            <Layers className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              스마트블록 노출 현황
            </h2>
            <p className="text-sm text-muted-foreground">
              키워드를 검색 중입니다...
            </p>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </section>
    );
  }

  if (!results || results.length === 0) {
    return (
      <section className="space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-border/50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 flex items-center justify-center">
            <Layers className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              스마트블록 노출 현황
            </h2>
            <p className="text-sm text-muted-foreground">
              실시간 수집된 노출 데이터
            </p>
          </div>
        </div>
        <Card className="border-border/50">
          <EmptyState
            variant="no-results"
            title="스마트블록 결과가 없습니다"
            description="해당 키워드에 대한 스마트블록이 검색되지 않았습니다."
            suggestions={[
              "다른 키워드로 검색해보세요",
              "인기 키워드는 더 많은 결과를 보여줍니다"
            ]}
          />
        </Card>
      </section>
    );
  }

  const gridCols =
    results.length === 1
      ? "grid-cols-1 max-w-2xl"
      : results.length === 2
        ? "grid-cols-1 md:grid-cols-2"
        : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-border/50 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 flex items-center justify-center">
            <Layers className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              스마트블록 노출 현황
            </h2>
            <p className="text-sm text-muted-foreground">
              실시간 수집된 노출 데이터
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="text-xs font-medium bg-violet-500/5 text-violet-600 dark:text-violet-400 border-violet-500/20"
        >
          <Zap className="w-3 h-3 mr-1.5" />
          Live Crawling
        </Badge>
      </div>

      <div className={`grid gap-5 ${gridCols}`}>
        {results.map((section, idx) => {
          const style = getSectionStyle(section.sectionTitle);
          return (
            <Card
              key={idx}
              className="overflow-hidden border-border/50 shadow-sm"
            >
              <CardHeader
                className={`pb-3 ${style.bg} border-b border-border/30`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.bg} ${style.text}`}
                  >
                    {getSectionIcon(section.sectionTitle)}
                  </div>
                  <CardTitle className="text-sm font-bold flex-1">
                    {section.sectionTitle}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-semibold ${style.text} ${style.border}`}
                  >
                    {section.posts.length}건
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-80">
                  <div className="p-4 space-y-2">
                    {section.posts.map((post, postIdx) => (
                      <a
                        key={postIdx}
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block p-3 rounded-lg hover:bg-muted/60 transition-all duration-200 border border-transparent hover:border-border/50"
                        data-testid={`link-smartblock-item-${idx}-${postIdx}`}
                      >
                        <div className="flex items-start gap-3">
                          {post.rank && (
                            <div
                              className={`w-7 h-7 rounded-lg ${style.bg} ${style.text} flex items-center justify-center text-xs font-bold shrink-0`}
                            >
                              {post.rank}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4
                                className="text-sm font-medium leading-snug line-clamp-1 group-hover:text-primary transition-colors"
                                dangerouslySetInnerHTML={{ __html: post.title }}
                              />
                              <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </div>
                            {post.summary && (
                              <p
                                className="text-xs text-muted-foreground/80 line-clamp-2 mt-1.5 leading-relaxed"
                                dangerouslySetInnerHTML={{
                                  __html: post.summary,
                                }}
                              />
                            )}
                            {post.isNews && (post.press || post.date) && (
                              <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground/70">
                                {post.press && (
                                  <span className="font-medium">
                                    {post.press}
                                  </span>
                                )}
                                {post.press && post.date && <span>·</span>}
                                {post.date && <span>{post.date}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </a>
                    ))}
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
