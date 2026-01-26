import React, { useState } from "react";
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
import type { SovRunAdmin } from "./types";

export function SovRunsTab() {
  const [page, setPage] = useState(0);
  const limit = 20;
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [draftStatus, setDraftStatus] = useState<string>("all");
  const [draftStartDate, setDraftStartDate] = useState<string>("");
  const [draftEndDate, setDraftEndDate] = useState<string>("");
  const [draftKeyword, setDraftKeyword] = useState<string>("");

  const [appliedFilters, setAppliedFilters] = useState({
    status: "all",
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
      if (appliedFilters.status && appliedFilters.status !== "all") params.append("status", appliedFilters.status);
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
    setDraftStatus("all");
    setDraftStartDate("");
    setDraftEndDate("");
    setDraftKeyword("");
    setAppliedFilters({
      status: "all",
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

  const getAppliedFilterBadges = () => {
    const badges = [];
    if (appliedFilters.status && appliedFilters.status !== "all") {
      badges.push({ label: "상태", value: getStatusLabel(appliedFilters.status) });
    }
    if (appliedFilters.startDate) badges.push({ label: "시작일", value: appliedFilters.startDate });
    if (appliedFilters.endDate) badges.push({ label: "종료일", value: appliedFilters.endDate });
    if (appliedFilters.keyword) badges.push({ label: "키워드", value: appliedFilters.keyword });
    return badges;
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (appliedFilters.status && appliedFilters.status !== "all") params.append("status", appliedFilters.status);
    if (appliedFilters.startDate) params.append("startDate", appliedFilters.startDate);
    if (appliedFilters.endDate) params.append("endDate", appliedFilters.endDate);
    window.open(`/api/admin/export/sov-runs?${params}`, "_blank");
  };

  const completedCount = data?.runs.filter(r => r.status === "completed").length || 0;
  const failedCount = data?.runs.filter(r => r.status === "failed").length || 0;

  return (
    <TabPageLayout
      summary={data ? [
        { label: "전체", value: data.total },
        { label: "완료", value: completedCount, variant: "success" },
        { label: "실패", value: failedCount, variant: failedCount > 0 ? "destructive" : "default" },
      ] : undefined}
      actions={<ExportButton onClick={handleExport} />}
      filterContent={
        <FilterRow onApply={handleApplyFilters} onReset={handleResetFilters}>
          <FilterField label="상태">
            <Select value={draftStatus} onValueChange={setDraftStatus}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="pending">대기</SelectItem>
                <SelectItem value="processing">처리중</SelectItem>
                <SelectItem value="completed">완료</SelectItem>
                <SelectItem value="failed">실패</SelectItem>
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
          <FilterField label="마켓 키워드">
            <Input 
              placeholder="키워드..."
              className="w-32"
              value={draftKeyword}
              onChange={(e) => setDraftKeyword(e.target.value)}
            />
          </FilterField>
        </FilterRow>
      }
      appliedFilters={getAppliedFilterBadges()}
      onClearFilters={handleResetFilters}
      isLoading={isLoading}
    >
      {!isLoading && (!data?.runs.length) ? (
        <EmptyState 
          type={getAppliedFilterBadges().length > 0 ? "no-filter-results" : "no-data"}
          action={getAppliedFilterBadges().length > 0 ? { label: "필터 초기화", onClick: handleResetFilters } : undefined}
        />
      ) : (
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
                <TableLoading rows={5} columnWidths={["w-4", "w-32", "w-40", "w-16", "w-12", "w-24"]} />
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
