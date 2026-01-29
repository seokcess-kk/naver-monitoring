import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { sanitizeHtml } from "@/lib/sanitize";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useServiceStatus } from "@/components/service-status-alert";
import {
  Layers,
  MapPin,
  Newspaper,
  FileText,
  ExternalLink,
  Zap,
  AlertTriangle,
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
  highlightTerm?: string;
}

function highlightText(text: string, term: string): string {
  if (!term || term.length < 2) return text;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  return text.replace(
    regex,
    '<mark class="bg-yellow-200 dark:bg-yellow-500/40 px-0.5 rounded">$1</mark>',
  );
}

function getSectionIcon(title: string) {
  if (title.includes("플레이스") || title.includes("지도")) {
    return <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4" />;
  }
  if (title.includes("뉴스")) {
    return <Newspaper className="w-3.5 h-3.5 md:w-4 md:h-4" />;
  }
  return <FileText className="w-3.5 h-3.5 md:w-4 md:h-4" />;
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
  highlightTerm,
}: SmartBlockSectionProps) {
  const { chromeAvailable } = useServiceStatus();
  const isChromeAvailable = chromeAvailable !== false;

  if (isLoading) {
    return (
      <section className="space-y-4 md:space-y-6">
        <div className="flex items-center gap-3 md:gap-4 pb-3 md:pb-4 border-b border-border/50">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 flex items-center justify-center">
            <Layers className="w-4 h-4 md:w-5 md:h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight">
              스마트블록 노출 현황
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground">
              키워드를 검색 중입니다...
            </p>
          </div>
        </div>
        <div className="mobile-horizontal-scroll md:grid md:grid-cols-2 xl:grid-cols-3 md:gap-5">
          <Skeleton className="h-64 md:h-72 w-[280px] md:w-auto rounded-xl shrink-0" />
          <Skeleton className="h-64 md:h-72 w-[280px] md:w-auto rounded-xl shrink-0" />
          <Skeleton className="h-64 md:h-72 w-[280px] md:w-auto rounded-xl shrink-0" />
        </div>
      </section>
    );
  }

  const hasData = results && results.length > 0;

  if (!hasData) {
    return (
      <section className="space-y-4 md:space-y-6">
        <div className="flex items-center gap-3 md:gap-4 pb-3 md:pb-4 border-b border-border/50">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 flex items-center justify-center">
            <Layers className="w-4 h-4 md:w-5 md:h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight">
              스마트블록 노출 현황
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground">
              실시간 수집된 노출 데이터
            </p>
          </div>
        </div>
        {chromeAvailable === false && (
          <Alert
            variant="destructive"
            className="border-amber-500/50 bg-amber-500/10"
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              스마트블록 크롤링 서비스가 점검 중입니다. 기본 검색 결과만
              표시됩니다.
            </AlertDescription>
          </Alert>
        )}
        <Card className="border-border/50">
          <EmptyState
            variant="no-results"
            title="스마트블록 결과가 없습니다"
            description={
              chromeAvailable === false
                ? "크롤링 서비스 점검 중으로 스마트블록을 수집할 수 없습니다."
                : "해당 키워드에 대한 스마트블록이 검색되지 않았습니다."
            }
            suggestions={
              isChromeAvailable
                ? [
                    "다른 키워드로 검색해보세요",
                    "인기 키워드는 더 많은 결과를 보여줍니다",
                  ]
                : []
            }
          />
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 md:gap-4 pb-3 md:pb-4 border-b border-border/50 flex-wrap">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 flex items-center justify-center">
            <Layers className="w-4 h-4 md:w-5 md:h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight">
              스마트블록 노출 현황
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground">
              실시간 수집된 노출 데이터
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[10px] md:text-xs font-medium bg-violet-500/5 text-violet-600 dark:text-violet-400 border-violet-500/20"
          >
            <Zap className="w-2.5 h-2.5 md:w-3 md:h-3 mr-1 md:mr-1.5" />
            Live
          </Badge>
        </div>
      </div>

      <div className="mobile-horizontal-scroll md:grid md:grid-cols-2 xl:grid-cols-3 md:gap-5">
        {results.map((section, idx) => {
          const style = getSectionStyle(section.sectionTitle);
          return (
            <Card
              key={idx}
              className="overflow-hidden border-border/50 shadow-sm w-[300px] md:w-auto shrink-0 hover-lift"
            >
              <CardHeader
                className={`pb-2.5 md:pb-3 ${style.bg} border-b border-border/30`}
              >
                <div className="flex items-center gap-2.5 md:gap-3">
                  <div
                    className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center ${style.bg} ${style.text}`}
                  >
                    {getSectionIcon(section.sectionTitle)}
                  </div>
                  <CardTitle className="text-xs md:text-sm font-bold flex-1 truncate">
                    {section.sectionTitle}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={`text-[9px] md:text-[10px] font-semibold ${style.text} ${style.border}`}
                  >
                    {section.posts.length}건
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-60 md:h-80">
                  <div className="p-3 md:p-4 space-y-1.5 md:space-y-2">
                    {section.posts.map((post, postIdx) => (
                      <a
                        key={postIdx}
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block p-2.5 md:p-3 rounded-lg hover:bg-muted/60 transition-all duration-200 border border-transparent hover:border-border/50"
                        data-testid={`link-smartblock-item-${idx}-${postIdx}`}
                      >
                        <div className="flex items-start gap-2.5 md:gap-3">
                          {post.rank && (
                            <div
                              className={`w-6 h-6 md:w-7 md:h-7 rounded-lg ${style.bg} ${style.text} flex items-center justify-center text-[10px] md:text-xs font-bold shrink-0`}
                            >
                              {post.rank}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4
                                className="text-xs md:text-sm font-medium leading-snug line-clamp-1 group-hover:text-primary transition-colors"
                                dangerouslySetInnerHTML={{
                                  __html: sanitizeHtml(
                                    highlightTerm
                                      ? highlightText(post.title, highlightTerm)
                                      : post.title,
                                  ),
                                }}
                              />
                              <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </div>
                            {post.summary && (
                              <p
                                className="text-[10px] md:text-xs text-muted-foreground/80 line-clamp-2 mt-1 md:mt-1.5 leading-relaxed"
                                dangerouslySetInnerHTML={{
                                  __html: sanitizeHtml(
                                    highlightTerm
                                      ? highlightText(
                                          post.summary,
                                          highlightTerm,
                                        )
                                      : post.summary,
                                  ),
                                }}
                              />
                            )}
                            {post.isNews && (post.press || post.date) && (
                              <div className="flex items-center gap-1.5 md:gap-2 mt-1.5 md:mt-2 text-[10px] md:text-[11px] text-muted-foreground/70">
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
