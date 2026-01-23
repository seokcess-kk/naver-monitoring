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
import { ChevronLeft, ChevronRight, Package, Plus, Edit, Trash2, Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { UserDetailModal } from "./UserDetailModal";
import type { AdminUser, UserSolutionAssignment } from "./types";

export function UsersTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === "superadmin";
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [solutionUser, setSolutionUser] = useState<AdminUser | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ solutionId: "", expiresAt: "" });
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null);
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/users", search, roleFilter, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
      });
      if (search) params.set("search", search);
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await apiRequest("GET", `/api/admin/users?${params}`);
      return res.json() as Promise<{ users: AdminUser[]; total: number }>;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ userId, role, status }: { userId: string; role?: string; status?: string }) => {
      const body: Record<string, string> = {};
      if (role) body.role = role;
      if (status) body.status = status;
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}`, body);
      if (!res.ok) throw new Error("업데이트 실패");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "사용자 정보가 업데이트되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSelectedUser(null);
    },
    onError: () => {
      toast({ title: "업데이트 실패", variant: "destructive" });
    },
  });

  const { data: solutionsData } = useQuery({
    queryKey: ["/api/admin/solutions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/solutions");
      return res.json() as Promise<{ solutions: { id: string; code: string; name: string; isActive: string }[] }>;
    },
    enabled: isSuperAdmin,
  });

  const { data: userSolutionsData, refetch: refetchUserSolutions } = useQuery({
    queryKey: ["/api/admin/user-solutions", solutionUser?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/user-solutions/${solutionUser!.id}`);
      return res.json() as Promise<{ assignments: UserSolutionAssignment[] }>;
    },
    enabled: !!solutionUser,
  });

  const assignMutation = useMutation({
    mutationFn: async ({ userId, solutionId, expiresAt }: { userId: string; solutionId: string; expiresAt?: string }) => {
      const res = await apiRequest("POST", `/api/admin/user-solutions/${userId}`, {
        solutionId,
        expiresAt: expiresAt || null,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "할당 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "솔루션 할당 완료" });
      refetchUserSolutions();
      setAssignDialogOpen(false);
      setNewAssignment({ solutionId: "", expiresAt: "" });
    },
    onError: (error: Error) => {
      toast({ title: "할당 실패", description: error.message, variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/user-solutions/${assignmentId}`);
      if (!res.ok) throw new Error("해제 실패");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "솔루션 해제 완료" });
      refetchUserSolutions();
    },
    onError: () => {
      toast({ title: "해제 실패", variant: "destructive" });
    },
  });

  const [editAssignment, setEditAssignment] = useState<UserSolutionAssignment | null>(null);

  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ assignmentId, isEnabled, expiresAt }: { assignmentId: string; isEnabled?: string; expiresAt?: string | null }) => {
      const res = await apiRequest("PATCH", `/api/admin/user-solutions/${assignmentId}`, { isEnabled, expiresAt });
      if (!res.ok) throw new Error("수정 실패");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "솔루션 설정 수정 완료" });
      refetchUserSolutions();
      setEditAssignment(null);
    },
    onError: () => {
      toast({ title: "수정 실패", variant: "destructive" });
    },
  });

  const handleEdit = (user: AdminUser) => {
    setSelectedUser(user);
    setEditRole(user.role);
    setEditStatus(user.status);
  };

  const handleSave = () => {
    if (!selectedUser) return;
    const updates: { userId: string; role?: string; status?: string } = { userId: selectedUser.id };
    if (editRole !== selectedUser.role) updates.role = editRole;
    if (editStatus !== selectedUser.status) updates.status = editStatus;
    if (updates.role || updates.status) {
      updateMutation.mutate(updates);
    } else {
      setSelectedUser(null);
    }
  };

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="이메일 검색..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="w-64"
        />
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(0); }}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="역할" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 역할</SelectItem>
            <SelectItem value="user">일반 사용자</SelectItem>
            <SelectItem value="admin">관리자</SelectItem>
            <SelectItem value="superadmin">슈퍼 관리자</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="active">활성</SelectItem>
            <SelectItem value="suspended">정지</SelectItem>
            <SelectItem value="pending">대기</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이메일</TableHead>
              <TableHead>이름</TableHead>
              <TableHead>역할</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>가입일</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : data?.users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>{user.firstName || user.lastName ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "-"}</TableCell>
                <TableCell>
                  <Badge variant={user.role === "superadmin" ? "destructive" : user.role === "admin" ? "default" : "secondary"}>
                    {user.role === "superadmin" ? "슈퍼 관리자" : user.role === "admin" ? "관리자" : "사용자"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={user.status === "active" ? "default" : user.status === "suspended" ? "destructive" : "outline"}>
                    {user.status === "active" ? "활성" : user.status === "suspended" ? "정지" : "대기"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setDetailUser(user)} title="상세 보기">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(user)}>
                      수정
                    </Button>
                    {isSuperAdmin && (
                      <Button variant="ghost" size="sm" onClick={() => setSolutionUser(user)}>
                        <Package className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
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
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>사용자 수정</DialogTitle>
            <DialogDescription>{selectedUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">역할</label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">일반 사용자</SelectItem>
                  <SelectItem value="admin">관리자</SelectItem>
                  <SelectItem value="superadmin">슈퍼 관리자</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">상태</label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">활성</SelectItem>
                  <SelectItem value="suspended">정지</SelectItem>
                  <SelectItem value="pending">대기</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUser(null)}>취소</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!solutionUser} onOpenChange={() => setSolutionUser(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>사용자 솔루션 관리</DialogTitle>
            <DialogDescription>{solutionUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium">할당된 솔루션</h4>
              <Button size="sm" onClick={() => setAssignDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                솔루션 할당
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>솔루션</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>만료일</TableHead>
                  <TableHead>할당일</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userSolutionsData?.assignments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                      할당된 솔루션이 없습니다
                    </TableCell>
                  </TableRow>
                )}
                {userSolutionsData?.assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{assignment.solutionName}</div>
                        <div className="text-xs text-muted-foreground">{assignment.solutionCode}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={assignment.isEnabled === "true" ? "default" : "secondary"}>
                        {assignment.isEnabled === "true" ? "활성" : "비활성"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {assignment.expiresAt 
                        ? new Date(assignment.expiresAt).toLocaleDateString("ko-KR")
                        : <span className="text-muted-foreground">무제한</span>
                      }
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(assignment.createdAt).toLocaleDateString("ko-KR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setEditAssignment(assignment)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:text-destructive"
                          onClick={() => revokeMutation.mutate(assignment.id)}
                          disabled={revokeMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSolutionUser(null)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>솔루션 할당</DialogTitle>
            <DialogDescription>{solutionUser?.email}에게 솔루션을 할당합니다</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">솔루션</label>
              <Select value={newAssignment.solutionId} onValueChange={(v) => setNewAssignment({ ...newAssignment, solutionId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="솔루션 선택..." />
                </SelectTrigger>
                <SelectContent>
                  {solutionsData?.solutions
                    .filter(s => s.isActive === "true")
                    .filter(s => !userSolutionsData?.assignments.some(a => a.solutionId === s.id))
                    .map((solution) => (
                      <SelectItem key={solution.id} value={solution.id}>
                        {solution.name} ({solution.code})
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">만료일 (선택)</label>
              <Input 
                type="date"
                value={newAssignment.expiresAt}
                onChange={(e) => setNewAssignment({ ...newAssignment, expiresAt: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">비워두면 무제한으로 설정됩니다</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>취소</Button>
            <Button 
              onClick={() => solutionUser && assignMutation.mutate({
                userId: solutionUser.id,
                solutionId: newAssignment.solutionId,
                expiresAt: newAssignment.expiresAt || undefined,
              })}
              disabled={!newAssignment.solutionId || assignMutation.isPending}
            >
              할당
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editAssignment} onOpenChange={() => setEditAssignment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>솔루션 설정 수정</DialogTitle>
            <DialogDescription>{editAssignment?.solutionName}</DialogDescription>
          </DialogHeader>
          {editAssignment && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">상태</label>
                <Select 
                  value={editAssignment.isEnabled} 
                  onValueChange={(v) => setEditAssignment({ ...editAssignment, isEnabled: v })}
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
              <div className="space-y-2">
                <label className="text-sm font-medium">만료일</label>
                <Input 
                  type="date"
                  value={editAssignment.expiresAt ? editAssignment.expiresAt.split("T")[0] : ""}
                  onChange={(e) => setEditAssignment({ ...editAssignment, expiresAt: e.target.value || null })}
                />
                <p className="text-xs text-muted-foreground">비워두면 무제한으로 설정됩니다</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAssignment(null)}>취소</Button>
            <Button 
              onClick={() => editAssignment && updateAssignmentMutation.mutate({
                assignmentId: editAssignment.id,
                isEnabled: editAssignment.isEnabled,
                expiresAt: editAssignment.expiresAt || null,
              })}
              disabled={updateAssignmentMutation.isPending}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <UserDetailModal 
        user={detailUser} 
        open={!!detailUser} 
        onClose={() => setDetailUser(null)} 
      />
    </div>
  );
}
