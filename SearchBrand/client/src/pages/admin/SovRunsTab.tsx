import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { SovRunAdmin } from "./types";

export function SovRunsTab() {
  const [page, setPage] = useState(0);
  const limit = 20;
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [draftStatus, setDraftStatus] = useState<string>("");
  const [draftStartDate, setDraftStartDate] = useState<string>("");
  const [draftEndDate, setDraftEndDate] = useState<string>("");
  const [draftKeyword, setDraftKeyword] = useState<string>("");

  const [appliedFilters, setAppliedFilters] = useState({
    status: "",
    startDate: "",
    endDate: "",
    keyword: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/sov-runs", page, appliedFilters],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
      });
      if (appliedFilters.status) params.append("status", appliedFilters.status);
      if (appliedFilters.startDate) params.append("startDate", appliedFilters.startDate);
      if (appliedFilters.endDate) params.append("endDate", appliedFilters.endDate);
      if (appliedFilters.keyword) params.append("keyword", appliedFilters.keyword);
      const res = await apiRequest("GET", `/api/admin/sov-runs?${params}`);
      return res.json() as Promise<{ runs: SovRunAdmin[]; total: number }>;
    },
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  const handleApplyFilters = () => {
    setAppliedFilters({
      status: draftStatus,
      startDate: draftStartDate,
      endDate: draftEndDate,
      keyword: draftKeyword,
    });
    setPage(0);
  };

  const handleResetFilters = () => {
    setDraftStatus("");
    setDraftStartDate("");
    setDraftEndDate("");
    setDraftKeyword("");
    setAppliedFilters({
      status: "",
      startDate: "",
      endDate: "",
      keyword: "",
    });
    setPage(0);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "대기",
      processing: "처리중",
      completed: "완료",
      failed: "실패",
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">상태</label>
            <select 
              className="border rounded px-2 py-1 text-sm"
              value={draftStatus}
              onChange={(e) => setDraftStatus(e.target.value)}
            >
              <option value="">전체</option>
              <option value="pending">대기</option>
              <option value="processing">처리중</option>
              <option value="completed">완료</option>
              <option value="failed">실패</option>
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
              placeholder="마켓키워드..."
              value={draftKeyword}
              onChange={(e) => setDraftKeyword(e.target.value)}
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
                if (appliedFilters.status) params.append("status", appliedFilters.status);
                if (appliedFilters.startDate) params.append("startDate", appliedFilters.startDate);
                if (appliedFilters.endDate) params.append("endDate", appliedFilters.endDate);
                window.open(`/api/admin/export/sov-runs?${params}`, "_blank");
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
              <TableHead className="w-8"></TableHead>
              <TableHead>키워드</TableHead>
              <TableHead>브랜드</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>노출 수</TableHead>
              <TableHead>생성일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                </TableRow>
              ))
            ) : data?.runs.map((run) => (
              <React.Fragment key={run.id}>
                <TableRow 
                  className={run.status === "failed" ? "cursor-pointer hover:bg-muted/50" : ""}
                  onClick={() => run.status === "failed" && run.errorMessage && setExpandedRow(expandedRow === run.id ? null : run.id)}
                >
                  <TableCell>
                    {run.status === "failed" && run.errorMessage && (
                      <ChevronRight className={`w-4 h-4 transition-transform ${expandedRow === run.id ? "rotate-90" : ""}`} />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{run.marketKeyword}</TableCell>
                  <TableCell className="max-w-xs truncate">{run.brands.join(", ")}</TableCell>
                  <TableCell>
                    <Badge variant={run.status === "completed" ? "default" : run.status === "failed" ? "destructive" : "outline"}>
                      {getStatusLabel(run.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{run.processedExposures}/{run.totalExposures}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(run.createdAt).toLocaleDateString("ko-KR")}
                  </TableCell>
                </TableRow>
                {expandedRow === run.id && run.errorMessage && (
                  <TableRow>
                    <TableCell colSpan={6} className="bg-red-50 dark:bg-red-950/20">
                      <div className="px-4 py-2">
                        <span className="text-xs font-medium text-red-600 dark:text-red-400">에러 원인:</span>
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1 font-mono whitespace-pre-wrap">
                          {run.errorMessage}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
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
