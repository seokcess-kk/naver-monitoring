import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { SearchLogAdmin } from "./types";

export function SearchLogsTab() {
  const [page, setPage] = useState(0);
  const limit = 30;

  const [draftSearchType, setDraftSearchType] = useState<string>("");
  const [draftStartDate, setDraftStartDate] = useState<string>("");
  const [draftEndDate, setDraftEndDate] = useState<string>("");
  const [draftKeywordFilter, setDraftKeywordFilter] = useState<string>("");
  const [draftUserIdFilter, setDraftUserIdFilter] = useState<string>("");

  const [appliedFilters, setAppliedFilters] = useState({
    searchType: "",
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
      if (appliedFilters.searchType) params.append("searchType", appliedFilters.searchType);
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
    setDraftSearchType("");
    setDraftStartDate("");
    setDraftEndDate("");
    setDraftKeywordFilter("");
    setDraftUserIdFilter("");
    setAppliedFilters({
      searchType: "",
      startDate: "",
      endDate: "",
      keyword: "",
      userId: "",
    });
    setPage(0);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">검색 타입</label>
            <select 
              className="border rounded px-2 py-1 text-sm"
              value={draftSearchType}
              onChange={(e) => setDraftSearchType(e.target.value)}
            >
              <option value="">전체</option>
              <option value="unified">통합검색</option>
              <option value="blog">블로그</option>
              <option value="cafe">카페</option>
              <option value="kin">지식iN</option>
              <option value="news">뉴스</option>
              <option value="sov">SOV</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">시작일</label>
            <input 
              type="date" 
              className="border rounded px-2 py-1 text-sm"
              value={draftStartDate}
              onChange={(e) => setDraftStartDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">종료일</label>
            <input 
              type="date" 
              className="border rounded px-2 py-1 text-sm"
              value={draftEndDate}
              onChange={(e) => setDraftEndDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">키워드 검색</label>
            <input 
              type="text" 
              className="border rounded px-2 py-1 text-sm w-32"
              placeholder="키워드..."
              value={draftKeywordFilter}
              onChange={(e) => setDraftKeywordFilter(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">사용자 ID</label>
            <input 
              type="text" 
              className="border rounded px-2 py-1 text-sm w-28"
              placeholder="ID..."
              value={draftUserIdFilter}
              onChange={(e) => setDraftUserIdFilter(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleApplyFilters}>
            적용
          </Button>
          <Button variant="ghost" size="sm" onClick={handleResetFilters}>
            초기화
          </Button>
          <div className="ml-auto">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const params = new URLSearchParams();
                if (appliedFilters.searchType) params.append("searchType", appliedFilters.searchType);
                if (appliedFilters.startDate) params.append("startDate", appliedFilters.startDate);
                if (appliedFilters.endDate) params.append("endDate", appliedFilters.endDate);
                if (appliedFilters.keyword) params.append("keyword", appliedFilters.keyword);
                if (appliedFilters.userId) params.append("userId", appliedFilters.userId);
                window.open(`/api/admin/export/search-logs?${params}`, "_blank");
              }}
            >
              <Download className="w-4 h-4 mr-1" />
              CSV 내보내기
            </Button>
          </div>
        </div>
      </Card>

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
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                </TableRow>
              ))
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
    </div>
  );
}
