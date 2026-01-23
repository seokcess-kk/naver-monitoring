import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Database, RefreshCw, Edit, Save, XCircle, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { MissingNameJob } from "./types";

export function DataQualityTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editPlaceName, setEditPlaceName] = useState("");

  const isSuperAdmin = user?.role === "superadmin";

  const { data: missingNames, isLoading, refetch, isError } = useQuery<{ jobs: MissingNameJob[]; count: number }>({
    queryKey: ["admin-missing-names"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/place-review-jobs/missing-names");
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "조회 실패");
      }
      return res.json();
    },
  });

  const updatePlaceNameMutation = useMutation({
    mutationFn: async ({ jobId, placeName }: { jobId: string; placeName: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/place-review-jobs/${jobId}/place-name`, { placeName });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "업데이트 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "플레이스명이 업데이트되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["admin-missing-names"] });
      setEditingJobId(null);
      setEditPlaceName("");
    },
    onError: (error: Error) => {
      toast({ title: "업데이트 실패", description: error.message, variant: "destructive" });
    },
  });

  const syncPlaceNamesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/place-review-jobs/sync-place-names");
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "동기화 실패");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "플레이스명 동기화 완료", description: `${data.updatedCount || 0}개 플레이스가 업데이트되었습니다` });
      queryClient.invalidateQueries({ queryKey: ["admin-missing-names"] });
    },
    onError: (error: Error) => {
      toast({ title: "동기화 실패", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (job: MissingNameJob) => {
    setEditingJobId(job.id);
    setEditPlaceName(job.placeName || "");
  };

  const handleSave = (jobId: string) => {
    if (!editPlaceName.trim()) {
      toast({ title: "플레이스명을 입력해주세요", variant: "destructive" });
      return;
    }
    updatePlaceNameMutation.mutate({ jobId, placeName: editPlaceName.trim() });
  };

  const handleCancel = () => {
    setEditingJobId(null);
    setEditPlaceName("");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            플레이스명 누락 관리
          </CardTitle>
          <CardDescription>
            플레이스명이 누락된 리뷰 분석 작업을 관리합니다. 변경 내역은 감사 로그에 자동으로 기록됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm">
                누락된 항목: {missingNames?.count || 0}건
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncPlaceNamesMutation.mutate()}
                disabled={syncPlaceNamesMutation.isPending || !isSuperAdmin}
                title={!isSuperAdmin ? "수퍼관리자만 사용 가능" : undefined}
              >
                {syncPlaceNamesMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                플레이스명 동기화
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                새로고침
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-4">
            "플레이스명 동기화" 버튼은 동일한 placeId를 가진 다른 작업에서 플레이스명을 복사합니다. 
            개별 편집은 수퍼관리자만 가능합니다.
          </p>

          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : isError ? (
            <div className="text-center py-8 text-muted-foreground">
              <XCircle className="w-12 h-12 mx-auto mb-2 text-red-500" />
              <p>데이터를 불러오는데 실패했습니다</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
                다시 시도
              </Button>
            </div>
          ) : (missingNames?.jobs.length || 0) === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
              <p>플레이스명이 누락된 작업이 없습니다</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Place ID</TableHead>
                    <TableHead>플레이스명</TableHead>
                    <TableHead className="w-[100px]">상태</TableHead>
                    <TableHead className="w-[150px]">생성일</TableHead>
                    <TableHead className="w-[100px]">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missingNames?.jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-mono text-xs">{job.placeId}</TableCell>
                      <TableCell>
                        {editingJobId === job.id ? (
                          <Input
                            value={editPlaceName}
                            onChange={(e) => setEditPlaceName(e.target.value)}
                            placeholder="플레이스명 입력"
                            className="h-8"
                            autoFocus
                          />
                        ) : (
                          <span className="text-muted-foreground italic">
                            {job.placeName || "(없음)"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={job.status === "completed" ? "default" : "secondary"}>
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(job.createdAt).toLocaleDateString("ko-KR")}
                      </TableCell>
                      <TableCell>
                        {editingJobId === job.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSave(job.id)}
                              disabled={updatePlaceNameMutation.isPending}
                            >
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleCancel}>
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : isSuperAdmin ? (
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(job)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
