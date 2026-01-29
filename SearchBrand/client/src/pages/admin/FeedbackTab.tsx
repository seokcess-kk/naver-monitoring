import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { TabPageLayout, FilterRow, FilterField } from "./TabPageLayout";
import { TableLoading, EmptyState } from "./components/StateComponents";
import { Lightbulb, HelpCircle, Bug, ChevronLeft, ChevronRight, ExternalLink, Clock } from "lucide-react";
import type { FeedbackCategory } from "@shared/schema";

interface FeedbackItem {
  id: string;
  userId: string | null;
  userEmail: string | null;
  category: FeedbackCategory;
  content: string;
  pageUrl: string | null;
  userAgent: string | null;
  status: "pending" | "reviewed" | "resolved";
  createdAt: string;
}

interface FeedbackResponse {
  feedback: FeedbackItem[];
  total: number;
  page: number;
  pageSize: number;
}

const CATEGORY_CONFIG: Record<FeedbackCategory, { label: string; icon: typeof Lightbulb; color: string }> = {
  feature: { label: "기능요청", icon: Lightbulb, color: "text-amber-500" },
  inquiry: { label: "문의", icon: HelpCircle, color: "text-blue-500" },
  bug: { label: "오류", icon: Bug, color: "text-red-500" },
};

const STATUS_CONFIG: Record<string, { label: string; variant: "outline" | "secondary" | "default" }> = {
  pending: { label: "대기중", variant: "outline" },
  in_progress: { label: "처리중", variant: "secondary" },
  resolved: { label: "해결됨", variant: "default" },
};

export function FeedbackTab() {
  const [page, setPage] = useState(1);
  const [draftCategoryFilter, setDraftCategoryFilter] = useState<string>("all");
  const [draftStatusFilter, setDraftStatusFilter] = useState<string>("all");
  const [appliedFilters, setAppliedFilters] = useState({ category: "all", status: "all" });
  const pageSize = 20;

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/admin/feedback", page, appliedFilters.category, appliedFilters.status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (appliedFilters.category !== "all") params.append("category", appliedFilters.category);
      if (appliedFilters.status !== "all") params.append("status", appliedFilters.status);
      
      const res = await apiRequest("GET", `/api/admin/feedback?${params}`);
      return res.json() as Promise<FeedbackResponse>;
    },
  });

  const handleApplyFilters = () => {
    setAppliedFilters({ category: draftCategoryFilter, status: draftStatusFilter });
    setPage(1);
  };

  const handleResetFilters = () => {
    setDraftCategoryFilter("all");
    setDraftStatusFilter("all");
    setAppliedFilters({ category: "all", status: "all" });
    setPage(1);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncateContent = (content: string, maxLen = 100) => {
    if (content.length <= maxLen) return content;
    return content.slice(0, maxLen) + "...";
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <TabPageLayout
      summary={data ? [{ label: "전체", value: data.total }] : undefined}
      filterContent={
        <FilterRow onApply={handleApplyFilters} onReset={handleResetFilters}>
          <FilterField label="카테고리">
            <Select value={draftCategoryFilter} onValueChange={setDraftCategoryFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="feature">기능요청</SelectItem>
                <SelectItem value="inquiry">문의</SelectItem>
                <SelectItem value="bug">오류</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="상태">
            <Select value={draftStatusFilter} onValueChange={setDraftStatusFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="pending">대기중</SelectItem>
                <SelectItem value="in_progress">처리중</SelectItem>
                <SelectItem value="resolved">해결됨</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
        </FilterRow>
      }
    >
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">피드백 목록</CardTitle>
          <CardDescription>사용자가 보낸 피드백을 확인합니다</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableLoading rows={5} columnWidths={["100px", "100px", "200px", "150px", "80px", "150px"]} />
          ) : error ? (
            <EmptyState type="no-data" title="오류 발생" description="피드백을 불러오는 중 오류가 발생했습니다" />
          ) : !data?.feedback?.length ? (
            <EmptyState type="no-data" title="피드백 없음" description="아직 피드백이 없습니다" />
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">카테고리</TableHead>
                      <TableHead className="w-[100px]">상태</TableHead>
                      <TableHead className="min-w-[200px]">내용</TableHead>
                      <TableHead className="w-[150px]">사용자</TableHead>
                      <TableHead className="w-[80px]">페이지</TableHead>
                      <TableHead className="w-[150px]">일시</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.feedback.map((item) => {
                      const catConfig = CATEGORY_CONFIG[item.category];
                      const statConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                      const Icon = catConfig?.icon || HelpCircle;
                      
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Icon className={`h-4 w-4 ${catConfig?.color || "text-muted-foreground"}`} />
                              <span className="text-sm">{catConfig?.label || item.category}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statConfig.variant}>{statConfig.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm whitespace-pre-wrap">{truncateContent(item.content)}</p>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {item.userEmail || "비로그인"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {item.pageUrl && (
                              <a
                                href={item.pageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline inline-flex items-center gap-1"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              {formatDate(item.createdAt)}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </TabPageLayout>
  );
}
