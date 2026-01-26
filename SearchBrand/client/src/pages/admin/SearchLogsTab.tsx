import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { TabPageLayout, FilterRow, FilterField, ExportButton } from "./TabPageLayout";
import { TableLoading, EmptyState } from "./components/StateComponents";
import type { SearchLogAdmin } from "./types";

export function SearchLogsTab() {
  const [page, setPage] = useState(0);
  const limit = 30;

  const [draftSearchType, setDraftSearchType] = useState<string>("all");
  const [draftStartDate, setDraftStartDate] = useState<string>("");
  const [draftEndDate, setDraftEndDate] = useState<string>("");
  const [draftKeywordFilter, setDraftKeywordFilter] = useState<string>("");
  const [draftUserIdFilter, setDraftUserIdFilter] = useState<string>("");

  const [appliedFilters, setAppliedFilters] = useState({
    searchType: "all",
    startDate: "",
    endDate: "",
    keyword: "",
    userId: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/search-logs", page, appliedFilters],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
      });
      if (appliedFilters.searchType && appliedFilters.searchType !== "all") params.append("searchType", appliedFilters.searchType);
      if (appliedFilters.startDate) params.append("startDate", appliedFilters.startDate);
      if (appliedFilters.endDate) params.append("endDate", appliedFilters.endDate);
      if (appliedFilters.keyword) params.append("keyword", appliedFilters.keyword);
      if (appliedFilters.userId) params.append("userId", appliedFilters.userId);
      const res = await apiRequest("GET", `/api/admin/search-logs?${params}`);
      return res.json() as Promise<{ logs: SearchLogAdmin[]; total: number }>;
    },
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  const handleApplyFilters = () => {
    setAppliedFilters({
      searchType: draftSearchType,
      startDate: draftStartDate,
      endDate: draftEndDate,
      keyword: draftKeywordFilter,
      userId: draftUserIdFilter,
    });
    setPage(0);
  };

  const handleResetFilters = () => {
    setDraftSearchType("all");
    setDraftStartDate("");
    setDraftEndDate("");
    setDraftKeywordFilter("");
    setDraftUserIdFilter("");
    setAppliedFilters({
      searchType: "all",
      startDate: "",
      endDate: "",
      keyword: "",
      userId: "",
    });
    setPage(0);
  };

  const getAppliedFilterBadges = () => {
    const badges = [];
    if (appliedFilters.searchType && appliedFilters.searchType !== "all") {
      const labels: Record<string, string> = {
        unified: "통합검색", blog: "블로그", cafe: "카페", 
        kin: "지식iN", news: "뉴스", sov: "SOV"
      };
      badges.push({ label: "타입", value: labels[appliedFilters.searchType] || appliedFilters.searchType });
    }
    if (appliedFilters.startDate) badges.push({ label: "시작일", value: appliedFilters.startDate });
    if (appliedFilters.endDate) badges.push({ label: "종료일", value: appliedFilters.endDate });
    if (appliedFilters.keyword) badges.push({ label: "키워드", value: appliedFilters.keyword });
    if (appliedFilters.userId) badges.push({ label: "사용자", value: appliedFilters.userId.slice(0, 8) });
    return badges;
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (appliedFilters.searchType && appliedFilters.searchType !== "all") params.append("searchType", appliedFilters.searchType);
    if (appliedFilters.startDate) params.append("startDate", appliedFilters.startDate);
    if (appliedFilters.endDate) params.append("endDate", appliedFilters.endDate);
    if (appliedFilters.keyword) params.append("keyword", appliedFilters.keyword);
    if (appliedFilters.userId) params.append("userId", appliedFilters.userId);
    window.open(`/api/admin/export/search-logs?${params}`, "_blank");
  };

  return (
    <TabPageLayout
      summary={data ? [
        { label: "전체", value: data.total },
      ] : undefined}
      actions={<ExportButton onClick={handleExport} />}
      filterContent={
        <FilterRow onApply={handleApplyFilters} onReset={handleResetFilters}>
          <FilterField label="검색 타입">
            <Select value={draftSearchType} onValueChange={setDraftSearchType}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="unified">통합검색</SelectItem>
                <SelectItem value="blog">블로그</SelectItem>
                <SelectItem value="cafe">카페</SelectItem>
                <SelectItem value="kin">지식iN</SelectItem>
                <SelectItem value="news">뉴스</SelectItem>
                <SelectItem value="sov">SOV</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="시작일">
            <Input 
              type="date" 
              className="w-36"
              value={draftStartDate}
              onChange={(e) => setDraftStartDate(e.target.value)}
            />
          </FilterField>
          <FilterField label="종료일">
            <Input 
              type="date" 
              className="w-36"
              value={draftEndDate}
              onChange={(e) => setDraftEndDate(e.target.value)}
            />
          </FilterField>
          <FilterField label="키워드">
            <Input 
              placeholder="키워드..."
              className="w-28"
              value={draftKeywordFilter}
              onChange={(e) => setDraftKeywordFilter(e.target.value)}
            />
          </FilterField>
          <FilterField label="사용자 ID">
            <Input 
              placeholder="ID..."
              className="w-24"
              value={draftUserIdFilter}
              onChange={(e) => setDraftUserIdFilter(e.target.value)}
            />
          </FilterField>
        </FilterRow>
      }
      appliedFilters={getAppliedFilterBadges()}
      onClearFilters={handleResetFilters}
      isLoading={isLoading}
    >
      {!isLoading && (!data?.logs.length) ? (
        <EmptyState 
          type={getAppliedFilterBadges().length > 0 ? "no-filter-results" : "no-data"}
          action={getAppliedFilterBadges().length > 0 ? { label: "필터 초기화", onClick: handleResetFilters } : undefined}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>키워드</TableHead>
                <TableHead>타입</TableHead>
                <TableHead>사용자 ID</TableHead>
                <TableHead>시간</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoading rows={5} columnWidths={["w-32", "w-16", "w-24", "w-32"]} />
              ) : data?.logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.keyword}</TableCell>
                  <TableCell>
                    <Badge variant={log.searchType === "sov" ? "default" : "secondary"}>
                      {log.searchType === "unified" ? "통합검색" : log.searchType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">{log.userId.slice(0, 8)}...</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(log.createdAt).toLocaleString("ko-KR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </TabPageLayout>
  );
}
