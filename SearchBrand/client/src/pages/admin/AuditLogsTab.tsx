import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { AuditLogAdmin } from "./types";

const actionOptions = [
  { value: "user_status_change", label: "사용자 상태 변경" },
  { value: "user_role_change", label: "사용자 역할 변경" },
  { value: "api_key_reset", label: "API 키 초기화" },
  { value: "api_key_delete", label: "API 키 삭제" },
  { value: "solution_create", label: "솔루션 생성" },
  { value: "solution_update", label: "솔루션 수정" },
  { value: "solution_delete", label: "솔루션 삭제" },
  { value: "user_solution_assign", label: "솔루션 할당" },
  { value: "user_solution_update", label: "솔루션 설정 변경" },
  { value: "user_solution_revoke", label: "솔루션 해제" },
  { value: "update_place_name", label: "플레이스명 수정" },
  { value: "sync_place_names", label: "플레이스명 동기화" },
];

const targetTypeOptions = [
  { value: "user", label: "사용자" },
  { value: "api_key", label: "API 키" },
  { value: "solution", label: "솔루션" },
  { value: "user_solution", label: "사용자 솔루션" },
  { value: "sov_run", label: "SOV 실행" },
  { value: "search_log", label: "검색 로그" },
  { value: "place_review_job", label: "플레이스 리뷰" },
];

export function AuditLogsTab() {
  const [page, setPage] = useState(0);
  const limit = 30;

  const [draftAction, setDraftAction] = useState<string>("");
  const [draftTargetType, setDraftTargetType] = useState<string>("");
  const [draftStartDate, setDraftStartDate] = useState<string>("");
  const [draftEndDate, setDraftEndDate] = useState<string>("");
  const [draftAdminEmail, setDraftAdminEmail] = useState<string>("");

  const [appliedFilters, setAppliedFilters] = useState({
    action: "",
    targetType: "",
    startDate: "",
    endDate: "",
    adminEmail: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/audit-logs", page, appliedFilters],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
      });
      if (appliedFilters.action) params.append("action", appliedFilters.action);
      if (appliedFilters.targetType) params.append("targetType", appliedFilters.targetType);
      if (appliedFilters.startDate) params.append("startDate", appliedFilters.startDate);
      if (appliedFilters.endDate) params.append("endDate", appliedFilters.endDate);
      if (appliedFilters.adminEmail) params.append("adminEmail", appliedFilters.adminEmail);
      const res = await apiRequest("GET", `/api/admin/audit-logs?${params}`);
      return res.json() as Promise<{ logs: AuditLogAdmin[]; total: number }>;
    },
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  const handleApplyFilters = () => {
    setAppliedFilters({
      action: draftAction,
      targetType: draftTargetType,
      startDate: draftStartDate,
      endDate: draftEndDate,
      adminEmail: draftAdminEmail,
    });
    setPage(0);
  };

  const handleResetFilters = () => {
    setDraftAction("");
    setDraftTargetType("");
    setDraftStartDate("");
    setDraftEndDate("");
    setDraftAdminEmail("");
    setAppliedFilters({
      action: "",
      targetType: "",
      startDate: "",
      endDate: "",
      adminEmail: "",
    });
    setPage(0);
  };

  const hasActiveFilters = Object.values(appliedFilters).some(v => v !== "");

  const getActionLabel = (action: string) => {
    const found = actionOptions.find(o => o.value === action);
    return found ? found.label : action;
  };

  const getTargetTypeLabel = (targetType: string) => {
    const found = targetTypeOptions.find(o => o.value === targetType);
    return found ? found.label : targetType;
  };

  const formatDetails = (details: string | null): string => {
    if (!details) return "-";
    try {
      const parsed = JSON.parse(details);
      const labelMap: Record<string, string> = {
        oldRole: "이전 역할",
        newRole: "새 역할",
        oldStatus: "이전 상태",
        newStatus: "새 상태",
        userId: "사용자",
        code: "코드",
        name: "이름",
        isActive: "활성화",
        solutionCode: "솔루션",
        isEnabled: "사용 가능",
        expiresAt: "만료일",
      };
      const valueMap: Record<string, string> = {
        user: "일반 사용자",
        admin: "관리자",
        superadmin: "슈퍼 관리자",
        active: "활성",
        suspended: "정지",
        pending: "대기",
        true: "예",
        false: "아니오",
      };
      return Object.entries(parsed)
        .map(([key, value]) => {
          const label = labelMap[key] || key;
          const displayValue = valueMap[String(value)] || String(value);
          return `${label}: ${displayValue}`;
        })
        .join(" / ");
    } catch {
      return details;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">작업 유형</label>
            <select 
              className="border rounded px-2 py-1 text-sm"
              value={draftAction}
              onChange={(e) => setDraftAction(e.target.value)}
            >
              <option value="">전체</option>
              {actionOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">대상 유형</label>
            <select 
              className="border rounded px-2 py-1 text-sm"
              value={draftTargetType}
              onChange={(e) => setDraftTargetType(e.target.value)}
            >
              <option value="">전체</option>
              {targetTypeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
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
            <label className="text-xs text-muted-foreground">관리자 이메일</label>
            <input 
              type="text" 
              className="border rounded px-2 py-1 text-sm w-40"
              placeholder="이메일..."
              value={draftAdminEmail}
              onChange={(e) => setDraftAdminEmail(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleApplyFilters}>
            적용
          </Button>
          <Button variant="ghost" size="sm" onClick={handleResetFilters}>
            초기화
          </Button>
        </div>
        {hasActiveFilters && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span>적용된 필터:</span>
            {appliedFilters.action && (
              <Badge variant="secondary" className="text-xs">{getActionLabel(appliedFilters.action)}</Badge>
            )}
            {appliedFilters.targetType && (
              <Badge variant="secondary" className="text-xs">{getTargetTypeLabel(appliedFilters.targetType)}</Badge>
            )}
            {appliedFilters.startDate && (
              <Badge variant="secondary" className="text-xs">시작: {appliedFilters.startDate}</Badge>
            )}
            {appliedFilters.endDate && (
              <Badge variant="secondary" className="text-xs">종료: {appliedFilters.endDate}</Badge>
            )}
            {appliedFilters.adminEmail && (
              <Badge variant="secondary" className="text-xs">관리자: {appliedFilters.adminEmail}</Badge>
            )}
          </div>
        )}
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>관리자</TableHead>
              <TableHead>작업</TableHead>
              <TableHead>대상</TableHead>
              <TableHead>상세</TableHead>
              <TableHead>시간</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                </TableRow>
              ))
            ) : data?.logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm">
                  {log.adminEmail || <span className="text-muted-foreground italic">알 수 없음</span>}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{getActionLabel(log.action)}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {getTargetTypeLabel(log.targetType)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-sm">
                  {formatDetails(log.details)}
                </TableCell>
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
