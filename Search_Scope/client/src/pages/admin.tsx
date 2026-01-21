import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Search, 
  Activity, 
  Key, 
  FileText, 
  Settings,
  Shield,
  ArrowLeft,
  RefreshCw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Server,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Package,
  Plus,
  Edit,
  Calendar,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface AdminStats {
  users: { total: number; active: number; suspended: number };
  sovRuns: { total: number; completed: number; failed: number; pending: number };
  searchLogs: { total: number; unified: number; sov: number };
  apiKeys: { total: number };
}

interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SovRunAdmin {
  id: string;
  userId: string;
  marketKeyword: string;
  brands: string[];
  status: string;
  totalExposures: string;
  processedExposures: string;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface SearchLogAdmin {
  id: string;
  userId: string;
  searchType: string;
  keyword: string;
  createdAt: string;
}

interface AuditLogAdmin {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

function StatsCards({ stats }: { stats: AdminStats | undefined }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">사용자</span>
          </div>
          <p className="text-2xl font-bold">{stats.users.total}</p>
          <p className="text-xs text-muted-foreground">
            활성 {stats.users.active} / 정지 {stats.users.suspended}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-green-500" />
            <span className="text-sm text-muted-foreground">SOV 분석</span>
          </div>
          <p className="text-2xl font-bold">{stats.sovRuns.total}</p>
          <p className="text-xs text-muted-foreground">
            완료 {stats.sovRuns.completed} / 실패 {stats.sovRuns.failed}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-muted-foreground">검색 로그</span>
          </div>
          <p className="text-2xl font-bold">{stats.searchLogs.total}</p>
          <p className="text-xs text-muted-foreground">
            통합 {stats.searchLogs.unified} / SOV {stats.searchLogs.sov}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-4 h-4 text-orange-500" />
            <span className="text-sm text-muted-foreground">API 키</span>
          </div>
          <p className="text-2xl font-bold">{stats.apiKeys.total}</p>
          <p className="text-xs text-muted-foreground">등록된 키</p>
        </CardContent>
      </Card>
    </div>
  );
}

interface UserSolutionAssignment {
  id: string;
  solutionId: string;
  solutionCode: string;
  solutionName: string;
  isEnabled: string;
  expiresAt: string | null;
  createdAt: string;
}

function UsersTab() {
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
    </div>
  );
}

function SovRunsTab() {
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/sov-runs", page],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
      });
      const res = await apiRequest("GET", `/api/admin/sov-runs?${params}`);
      return res.json() as Promise<{ runs: SovRunAdmin[]; total: number }>;
    },
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="space-y-4">
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
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
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                </TableRow>
              ))
            ) : data?.runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell className="font-medium">{run.marketKeyword}</TableCell>
                <TableCell className="max-w-xs truncate">{run.brands.join(", ")}</TableCell>
                <TableCell>
                  <Badge variant={run.status === "completed" ? "default" : run.status === "failed" ? "destructive" : "outline"}>
                    {run.status}
                  </Badge>
                </TableCell>
                <TableCell>{run.processedExposures}/{run.totalExposures}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(run.createdAt).toLocaleDateString("ko-KR")}
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

function SearchLogsTab() {
  const [page, setPage] = useState(0);
  const limit = 30;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/search-logs", page],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
      });
      const res = await apiRequest("GET", `/api/admin/search-logs?${params}`);
      return res.json() as Promise<{ logs: SearchLogAdmin[]; total: number }>;
    },
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="space-y-4">
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
                    {log.searchType}
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

function AuditLogsTab() {
  const [page, setPage] = useState(0);
  const limit = 30;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/audit-logs", page],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
      });
      const res = await apiRequest("GET", `/api/admin/audit-logs?${params}`);
      return res.json() as Promise<{ logs: AuditLogAdmin[]; total: number }>;
    },
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      user_status_change: "사용자 상태 변경",
      user_role_change: "사용자 역할 변경",
      api_key_reset: "API 키 초기화",
      api_key_delete: "API 키 삭제",
      solution_create: "솔루션 생성",
      solution_update: "솔루션 수정",
      solution_delete: "솔루션 삭제",
      user_solution_assign: "솔루션 할당",
      user_solution_update: "솔루션 설정 변경",
      user_solution_revoke: "솔루션 해제",
    };
    return labels[action] || action;
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
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
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
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                </TableRow>
              ))
            ) : data?.logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  <Badge variant="outline">{getActionLabel(log.action)}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{log.targetType}</TableCell>
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

interface ApiKeyAdmin {
  id: string;
  userId: string;
  clientId: string;
  createdAt: string;
  updatedAt: string;
}

function ApiKeysTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyAdmin | null>(null);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/api-keys", page],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
      });
      const res = await apiRequest("GET", `/api/admin/api-keys?${params}`);
      return res.json() as Promise<{ apiKeys: ApiKeyAdmin[]; total: number }>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/api-keys/${keyId}`);
      if (!res.ok) throw new Error("삭제 실패");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "API 키가 삭제되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats/overview"] });
      setDeleteTarget(null);
    },
    onError: () => {
      toast({ title: "삭제 실패", variant: "destructive" });
    },
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="space-y-4">
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client ID</TableHead>
              <TableHead>사용자 ID</TableHead>
              <TableHead>생성일</TableHead>
              <TableHead>수정일</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : data?.apiKeys.map((key) => (
              <TableRow key={key.id}>
                <TableCell className="font-mono text-sm">{key.clientId}</TableCell>
                <TableCell className="text-muted-foreground text-xs font-mono">{key.userId.slice(0, 8)}...</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(key.createdAt).toLocaleDateString("ko-KR")}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(key.updatedAt).toLocaleDateString("ko-KR")}
                </TableCell>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(key)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
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

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API 키 삭제</DialogTitle>
            <DialogDescription>
              이 API 키를 삭제하시겠습니까? 사용자는 더 이상 네이버 검색을 사용할 수 없게 됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">Client ID: <span className="font-mono">{deleteTarget?.clientId}</span></p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>취소</Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface SolutionAdmin {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: string;
  createdAt: string;
  updatedAt: string;
}

interface UserSolutionAdmin {
  id: string;
  solutionId: string;
  solutionCode: string;
  solutionName: string;
  isEnabled: string;
  expiresAt: string | null;
  createdAt: string;
}

function SolutionsTab() {
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
                placeholder="sov_analysis"
                value={newSolution.code}
                onChange={(e) => setNewSolution({ ...newSolution, code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">이름</label>
              <Input 
                placeholder="SOV 분석"
                value={newSolution.name}
                onChange={(e) => setNewSolution({ ...newSolution, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">설명 (선택)</label>
              <Input 
                placeholder="브랜드 점유율을 분석합니다"
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

interface ServiceStatus {
  name: string;
  status: "ok" | "error" | "unknown";
  message: string;
  checkedAt: string;
  affectedFeatures: string[];
}

interface AllServicesStatus {
  redis: ServiceStatus;
  chrome: ServiceStatus;
  openai: ServiceStatus;
  database: ServiceStatus;
  overallStatus: "ok" | "degraded" | "error";
  checkedAt: string;
}

function SystemStatusTab() {
  const { data: status, isLoading, refetch, isFetching } = useQuery<AllServicesStatus>({
    queryKey: ["admin-services-status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/services/status");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ok":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ok":
        return <Badge className="bg-green-500">정상</Badge>;
      case "error":
        return <Badge variant="destructive">오류</Badge>;
      default:
        return <Badge variant="secondary">알 수 없음</Badge>;
    }
  };

  const getOverallStatusBadge = (status: string) => {
    switch (status) {
      case "ok":
        return <Badge className="bg-green-500 text-lg px-4 py-1">모든 서비스 정상</Badge>;
      case "degraded":
        return <Badge variant="secondary" className="bg-amber-500 text-lg px-4 py-1">일부 서비스 오류</Badge>;
      case "error":
        return <Badge variant="destructive" className="text-lg px-4 py-1">시스템 오류</Badge>;
      default:
        return <Badge variant="secondary" className="text-lg px-4 py-1">확인 중</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-8">
            <div className="flex justify-center">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const services = status ? [
    { key: "database", ...status.database },
    { key: "redis", ...status.redis },
    { key: "chrome", ...status.chrome },
    { key: "openai", ...status.openai },
  ] : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                시스템 상태
              </CardTitle>
              <CardDescription>
                마지막 확인: {status ? new Date(status.checkedAt).toLocaleString("ko-KR") : "-"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              {status && getOverallStatusBadge(status.overallStatus)}
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
                새로고침
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>서비스</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>메시지</TableHead>
                <TableHead>영향받는 기능</TableHead>
                <TableHead>확인 시간</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.key}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(service.status)}
                      {service.name}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(service.status)}</TableCell>
                  <TableCell className="text-sm">{service.message}</TableCell>
                  <TableCell>
                    {service.affectedFeatures.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {service.affectedFeatures.map((feature, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">{feature}</Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(service.checkedAt).toLocaleTimeString("ko-KR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>서비스 설명</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">PostgreSQL (필수)</h4>
              <p className="text-sm text-muted-foreground">데이터베이스 서비스. 이 서비스가 중단되면 전체 앱이 작동하지 않습니다.</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">Redis (선택)</h4>
              <p className="text-sm text-muted-foreground">백그라운드 작업 큐 서비스. 중단 시 플레이스 리뷰 분석 기능이 비활성화됩니다.</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">Chrome/Puppeteer (선택)</h4>
              <p className="text-sm text-muted-foreground">웹 크롤링 서비스. 중단 시 스마트블록 크롤링 기능이 비활성화됩니다.</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">OpenAI (선택)</h4>
              <p className="text-sm text-muted-foreground">AI 분석 서비스. 중단 시 SOV 분석 기능이 비활성화됩니다.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["/api/admin/stats/overview"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/stats/overview");
      return res.json() as Promise<AdminStats>;
    },
    enabled: isAuthenticated && (user?.role === "admin" || user?.role === "superadmin"),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/auth" />;
  }

  if (user?.role !== "admin" && user?.role !== "superadmin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-semibold mb-2">접근 권한 없음</h2>
            <p className="text-muted-foreground mb-4">관리자 권한이 필요한 페이지입니다.</p>
            <Button variant="outline" onClick={() => window.location.href = "/"}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              홈으로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => window.location.href = "/"}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              대시보드
            </Button>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-xl font-bold">Admin Console</h1>
            <Badge variant={user?.role === "superadmin" ? "destructive" : "default"}>
              {user?.role === "superadmin" ? "슈퍼 관리자" : "관리자"}
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchStats()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <StatsCards stats={stats} />

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              사용자
            </TabsTrigger>
            <TabsTrigger value="sov" className="gap-2">
              <Activity className="w-4 h-4" />
              SOV 분석
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <Search className="w-4 h-4" />
              검색 로그
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <FileText className="w-4 h-4" />
              감사 로그
            </TabsTrigger>
            <TabsTrigger value="apikeys" className="gap-2">
              <Key className="w-4 h-4" />
              API 키
            </TabsTrigger>
            <TabsTrigger value="solutions" className="gap-2">
              <Package className="w-4 h-4" />
              솔루션
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-2">
              <Server className="w-4 h-4" />
              시스템 상태
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
          <TabsContent value="sov">
            <SovRunsTab />
          </TabsContent>
          <TabsContent value="logs">
            <SearchLogsTab />
          </TabsContent>
          <TabsContent value="audit">
            <AuditLogsTab />
          </TabsContent>
          <TabsContent value="apikeys">
            <ApiKeysTab />
          </TabsContent>
          <TabsContent value="solutions">
            <SolutionsTab />
          </TabsContent>
          <TabsContent value="system">
            <SystemStatusTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
