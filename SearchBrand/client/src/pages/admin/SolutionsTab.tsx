import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Plus, Edit } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { SolutionAdmin } from "./types";

export function SolutionsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin";
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SolutionAdmin | null>(null);
  const [newSolution, setNewSolution] = useState({ code: "", name: "", description: "" });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/solutions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/solutions");
      return res.json() as Promise<{ solutions: SolutionAdmin[] }>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { code: string; name: string; description?: string }) => {
      const res = await apiRequest("POST", "/api/admin/solutions", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "생성 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "솔루션 생성 완료" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/solutions"] });
      setCreateDialogOpen(false);
      setNewSolution({ code: "", name: "", description: "" });
    },
    onError: (error: Error) => {
      toast({ title: "생성 실패", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; isActive?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/solutions/${id}`, data);
      if (!res.ok) throw new Error("수정 실패");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "솔루션 수정 완료" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/solutions"] });
      setEditTarget(null);
    },
    onError: () => {
      toast({ title: "수정 실패", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">솔루션 카탈로그</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
          {isSuperAdmin && (
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              솔루션 추가
            </Button>
          )}
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>코드</TableHead>
              <TableHead>이름</TableHead>
              <TableHead>설명</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>생성일</TableHead>
              {isSuperAdmin && <TableHead>관리</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  {isSuperAdmin && <TableCell><Skeleton className="h-4 w-16" /></TableCell>}
                </TableRow>
              ))
            ) : data?.solutions.map((solution) => (
              <TableRow key={solution.id}>
                <TableCell className="font-mono text-sm">{solution.code}</TableCell>
                <TableCell className="font-medium">{solution.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                  {solution.description || "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={solution.isActive === "true" ? "default" : "secondary"}>
                    {solution.isActive === "true" ? "활성" : "비활성"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(solution.createdAt).toLocaleDateString("ko-KR")}
                </TableCell>
                {isSuperAdmin && (
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setEditTarget(solution)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!isLoading && (!data?.solutions || data.solutions.length === 0) && (
              <TableRow>
                <TableCell colSpan={isSuperAdmin ? 6 : 5} className="text-center text-muted-foreground py-8">
                  등록된 솔루션이 없습니다
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 솔루션 추가</DialogTitle>
            <DialogDescription>새로운 솔루션을 등록합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">코드</label>
              <Input 
                placeholder="place_review"
                value={newSolution.code}
                onChange={(e) => setNewSolution({ ...newSolution, code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">이름</label>
              <Input 
                placeholder="플레이스 리뷰"
                value={newSolution.name}
                onChange={(e) => setNewSolution({ ...newSolution, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">설명 (선택)</label>
              <Input 
                placeholder="플레이스 리뷰를 분석합니다"
                value={newSolution.description}
                onChange={(e) => setNewSolution({ ...newSolution, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>취소</Button>
            <Button 
              onClick={() => createMutation.mutate(newSolution)}
              disabled={!newSolution.code || !newSolution.name || createMutation.isPending}
            >
              생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>솔루션 수정</DialogTitle>
            <DialogDescription>솔루션 정보를 수정합니다.</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">코드</label>
                <Input value={editTarget.code} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">이름</label>
                <Input 
                  value={editTarget.name}
                  onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">설명</label>
                <Input 
                  value={editTarget.description || ""}
                  onChange={(e) => setEditTarget({ ...editTarget, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">상태</label>
                <Select 
                  value={editTarget.isActive} 
                  onValueChange={(v) => setEditTarget({ ...editTarget, isActive: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">활성</SelectItem>
                    <SelectItem value="false">비활성</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>취소</Button>
            <Button 
              onClick={() => editTarget && updateMutation.mutate({
                id: editTarget.id,
                name: editTarget.name,
                description: editTarget.description || undefined,
                isActive: editTarget.isActive,
              })}
              disabled={updateMutation.isPending}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
