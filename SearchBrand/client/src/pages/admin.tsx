import { useState, useMemo } from "react";
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
  BarChart3,
  TrendingUp,
  MessageSquare,
  Download,
  Zap,
  Eye,
  Clock,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
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
      <div className="flex justify-end">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => window.open("/api/admin/export/sov-runs", "_blank")}
        >
          <Download className="w-4 h-4 mr-1" />
          CSV 내보내기
        </Button>
      </div>

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
                    {getStatusLabel(run.status)}
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
  const [searchType, setSearchType] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [keywordFilter, setKeywordFilter] = useState<string>("");
  const [userIdFilter, setUserIdFilter] = useState<string>("");
  const limit = 30;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/search-logs", page, searchType, startDate, endDate, keywordFilter, userIdFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
      });
      if (searchType) params.append("searchType", searchType);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (keywordFilter) params.append("keyword", keywordFilter);
      if (userIdFilter) params.append("userId", userIdFilter);
      const res = await apiRequest("GET", `/api/admin/search-logs?${params}`);
      return res.json() as Promise<{ logs: SearchLogAdmin[]; total: number }>;
    },
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  const handleApplyFilters = () => {
    setPage(0);
    refetch();
  };

  const handleResetFilters = () => {
    setSearchType("");
    setStartDate("");
    setEndDate("");
    setKeywordFilter("");
    setUserIdFilter("");
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
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
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
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">종료일</label>
            <input 
              type="date" 
              className="border rounded px-2 py-1 text-sm"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">키워드 검색</label>
            <input 
              type="text" 
              className="border rounded px-2 py-1 text-sm w-32"
              placeholder="키워드..."
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">사용자 ID</label>
            <input 
              type="text" 
              className="border rounded px-2 py-1 text-sm w-28"
              placeholder="ID..."
              value={userIdFilter}
              onChange={(e) => setUserIdFilter(e.target.value)}
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
                if (searchType) params.append("searchType", searchType);
                if (startDate) params.append("startDate", startDate);
                if (endDate) params.append("endDate", endDate);
                if (keywordFilter) params.append("keyword", keywordFilter);
                if (userIdFilter) params.append("userId", userIdFilter);
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

interface UserActivityInsights {
  activeUsers: { 
    period: number; 
    totalActivities: number;
    breakdown: {
      searches: number;
      sovAnalyses: number;
      placeReviews: number;
    };
  };
  popularKeywords: { keyword: string; count: number }[];
  searchByType: { searchType: string; count: number }[];
  dailySearchTrend: { date: string; count: number }[];
}

interface SovTrendInsights {
  summary: { total: number; completed: number; failed: number; successRate: number };
  recentKeywords: { keyword: string; count: number }[];
  dailyRunTrend: { date: string; total: number; completed: number; failed: number }[];
}

interface PlaceReviewInsights {
  summary: { totalJobs: number; completedJobs: number; totalReviews: number };
  sentimentDistribution: { sentiment: string; count: number }[];
  popularPlaces: { placeId: string; placeName: string | null; jobCount: number; totalReviews: number }[];
  dailyJobTrend: { date: string; total: number; completed: number }[];
}

interface SystemPerformanceInsights {
  apiUsage: { totalSearches: number; dailyUsage: { date: string; searches: number }[] };
  sovQueue: { total: number; completed: number; failed: number; successRate: number };
  placeReviewQueue: { total: number; completed: number; failed: number; pending: number; processing: number; successRate: number };
}

type DateRangeOption = "today" | "7d" | "30d" | "custom";

function InsightsTab() {
  const [dateRange, setDateRange] = useState<DateRangeOption>("7d");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [excludeInactive, setExcludeInactive] = useState<boolean>(true);

  const getDateParams = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let startDate: Date;
    let endDate: Date = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    switch (dateRange) {
      case "today":
        startDate = today;
        break;
      case "7d":
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "custom":
        startDate = customStartDate ? new Date(customStartDate) : new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = customEndDate ? new Date(new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000) : endDate;
        break;
      default:
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  };

  const dateParams = getDateParams();
  const queryParams = `?startDate=${encodeURIComponent(dateParams.startDate)}&endDate=${encodeURIComponent(dateParams.endDate)}`;

  const userActivityParams = `${queryParams}&excludeInactive=${excludeInactive}`;
  const { data: userActivity, isLoading: loadingUser, refetch: refetchUser } = useQuery<UserActivityInsights>({
    queryKey: ["/api/admin/insights/user-activity", dateRange, customStartDate, customEndDate, excludeInactive],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/insights/user-activity${userActivityParams}`);
      return res.json();
    },
  });

  const { data: sovTrends, isLoading: loadingSov, refetch: refetchSov } = useQuery<SovTrendInsights>({
    queryKey: ["/api/admin/insights/sov-trends", dateRange, customStartDate, customEndDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/insights/sov-trends${queryParams}`);
      return res.json();
    },
  });

  const { data: placeReviews, isLoading: loadingPlace, refetch: refetchPlace } = useQuery<PlaceReviewInsights>({
    queryKey: ["/api/admin/insights/place-reviews", dateRange, customStartDate, customEndDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/insights/place-reviews${queryParams}`);
      return res.json();
    },
  });

  const { data: systemPerf, isLoading: loadingSystem, refetch: refetchSystem } = useQuery<SystemPerformanceInsights>({
    queryKey: ["/api/admin/insights/system-performance", dateRange, customStartDate, customEndDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/insights/system-performance${queryParams}`);
      return res.json();
    },
  });

  const handleRefreshAll = () => {
    refetchUser();
    refetchSov();
    refetchPlace();
    refetchSystem();
  };

  const getDateRangeLabel = () => {
    switch (dateRange) {
      case "today": return "오늘";
      case "7d": return "최근 7일";
      case "30d": return "최근 30일";
      case "custom": 
        if (customStartDate && customEndDate) {
          return `${customStartDate} ~ ${customEndDate}`;
        }
        return "사용자 지정";
      default: return "최근 7일";
    }
  };

  const getSentimentLabel = (sentiment: string) => {
    const labels: Record<string, string> = {
      Positive: "긍정",
      Negative: "부정",
      Neutral: "중립",
    };
    return labels[sentiment] || sentiment;
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "Positive": return "text-green-600";
      case "Negative": return "text-red-600";
      default: return "text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-medium">데이터 인사이트</h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button 
              variant={dateRange === "today" ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setDateRange("today")}
              className="h-7 px-2 text-xs"
            >
              오늘
            </Button>
            <Button 
              variant={dateRange === "7d" ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setDateRange("7d")}
              className="h-7 px-2 text-xs"
            >
              7일
            </Button>
            <Button 
              variant={dateRange === "30d" ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setDateRange("30d")}
              className="h-7 px-2 text-xs"
            >
              30일
            </Button>
            <Button 
              variant={dateRange === "custom" ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setDateRange("custom")}
              className="h-7 px-2 text-xs"
            >
              지정
            </Button>
          </div>
          {dateRange === "custom" && (
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-7 w-32 text-xs"
              />
              <span className="text-muted-foreground">~</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-7 w-32 text-xs"
              />
            </div>
          )}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input 
              type="checkbox" 
              checked={excludeInactive}
              onChange={(e) => setExcludeInactive(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300"
            />
            비활성 계정 제외
          </label>
          <Button variant="outline" size="sm" onClick={handleRefreshAll} className="h-7">
            <RefreshCw className="w-3 h-3 mr-1" />
            새로고침
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              활성 사용자
              <span className="text-xs font-normal text-muted-foreground">({getDateRangeLabel()})</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">검색, SOV 분석, 리뷰 분석 중 하나 이상 사용한 사용자</p>
          </CardHeader>
          <CardContent>
            {loadingUser ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">활성 사용자 수</span>
                  <span className="font-semibold">{userActivity?.activeUsers.period || 0}명</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">총 활동 수</span>
                  <span className="font-semibold">{userActivity?.activeUsers.totalActivities || 0}건</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">검색</span>
                    <span>{userActivity?.activeUsers.breakdown?.searches || 0}건</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">SOV 분석</span>
                    <span>{userActivity?.activeUsers.breakdown?.sovAnalyses || 0}건</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">리뷰 분석</span>
                    <span>{userActivity?.activeUsers.breakdown?.placeReviews || 0}건</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              SOV 분석 현황
              <span className="text-xs font-normal text-muted-foreground">({getDateRangeLabel()})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSov ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">분석 건수</span>
                  <span className="font-semibold">{sovTrends?.summary.total || 0}건</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">성공률</span>
                  <span className="font-semibold text-green-600">{sovTrends?.summary.successRate || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">실패</span>
                  <span className="font-semibold text-red-600">{sovTrends?.summary.failed || 0}건</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              플레이스 리뷰 현황
              <span className="text-xs font-normal text-muted-foreground">({getDateRangeLabel()})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPlace ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">분석 작업</span>
                  <span className="font-semibold">{placeReviews?.summary.completedJobs || 0}건</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">분석 리뷰</span>
                  <span className="font-semibold">{placeReviews?.summary.totalReviews || 0}개</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">인기 검색 키워드 ({getDateRangeLabel()})</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingUser ? (
              <Skeleton className="h-40 w-full" />
            ) : userActivity?.popularKeywords.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다</p>
            ) : (
              <div className="space-y-2">
                {userActivity?.popularKeywords.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-5">{idx + 1}</span>
                      <span className="text-sm">{item.keyword}</span>
                    </div>
                    <Badge variant="secondary">{item.count}회</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">SOV 인기 키워드 ({getDateRangeLabel()})</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSov ? (
              <Skeleton className="h-40 w-full" />
            ) : sovTrends?.recentKeywords.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다</p>
            ) : (
              <div className="space-y-2">
                {sovTrends?.recentKeywords.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-5">{idx + 1}</span>
                      <span className="text-sm">{item.keyword}</span>
                    </div>
                    <Badge variant="secondary">{item.count}회</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">리뷰 감성 분포</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPlace ? (
              <Skeleton className="h-24 w-full" />
            ) : placeReviews?.sentimentDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다</p>
            ) : (
              <div className="space-y-3">
                {placeReviews?.sentimentDistribution.map((item) => (
                  <div key={item.sentiment} className="flex items-center justify-between">
                    <span className={`font-medium ${getSentimentColor(item.sentiment)}`}>
                      {getSentimentLabel(item.sentiment)}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-muted rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${item.sentiment === "Positive" ? "bg-green-500" : item.sentiment === "Negative" ? "bg-red-500" : "bg-gray-500"}`}
                          style={{ width: `${Math.min(100, (item.count / (placeReviews.summary.totalReviews || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">{item.count}개</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">인기 플레이스</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPlace ? (
              <Skeleton className="h-24 w-full" />
            ) : placeReviews?.popularPlaces.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다</p>
            ) : (
              <div className="space-y-2">
                {placeReviews?.popularPlaces.slice(0, 5).map((place, idx) => (
                  <div key={place.placeId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-5">{idx + 1}</span>
                      <span className="text-sm truncate max-w-48">{place.placeName || place.placeId}</span>
                    </div>
                    <Badge variant="outline">{place.totalReviews || 0}개 리뷰</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">채널별 검색 현황 ({getDateRangeLabel()})</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingUser ? (
              <Skeleton className="h-24 w-full" />
            ) : userActivity?.searchByType.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다</p>
            ) : (
              <div className="space-y-3">
                {userActivity?.searchByType.map((item) => {
                  const totalSearches = userActivity.searchByType.reduce((sum, i) => sum + i.count, 0);
                  const percentage = totalSearches > 0 ? Math.round((item.count / totalSearches) * 100) : 0;
                  const channelLabels: Record<string, string> = {
                    unified: "통합검색",
                    blog: "블로그",
                    cafe: "카페",
                    kin: "지식iN",
                    news: "뉴스",
                    sov: "SOV 분석",
                  };
                  return (
                    <div key={item.searchType} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{channelLabels[item.searchType] || item.searchType}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-muted rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${percentage}%` }} />
                        </div>
                        <span className="text-sm w-16 text-right">{item.count}회</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">일별 검색 추이 ({getDateRangeLabel()})</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingUser ? (
              <Skeleton className="h-24 w-full" />
            ) : userActivity?.dailySearchTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다</p>
            ) : (
              <div className="space-y-2">
                {userActivity?.dailySearchTrend.map((item) => {
                  const maxCount = Math.max(...(userActivity?.dailySearchTrend.map(d => d.count) || [1]));
                  const percentage = maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0;
                  const dateStr = new Date(item.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
                  return (
                    <div key={item.date} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground w-16">{dateStr}</span>
                      <div className="flex items-center gap-2 flex-1 ml-2">
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: `${percentage}%` }} />
                        </div>
                        <span className="text-sm w-12 text-right">{item.count}건</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">SOV 일별 분석 추이 ({getDateRangeLabel()})</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSov ? (
              <Skeleton className="h-24 w-full" />
            ) : sovTrends?.dailyRunTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다</p>
            ) : (
              <div className="space-y-2">
                {sovTrends?.dailyRunTrend.map((item) => {
                  const dateStr = new Date(item.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
                  return (
                    <div key={item.date} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground w-16">{dateStr}</span>
                      <div className="flex gap-4">
                        <span>전체: <span className="font-medium">{item.total}</span></span>
                        <span className="text-green-600">성공: {item.completed}</span>
                        <span className="text-red-600">실패: {item.failed}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">플레이스 리뷰 일별 분석 ({getDateRangeLabel()})</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPlace ? (
              <Skeleton className="h-24 w-full" />
            ) : placeReviews?.dailyJobTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다</p>
            ) : (
              <div className="space-y-2">
                {placeReviews?.dailyJobTrend.map((item) => {
                  const dateStr = new Date(item.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
                  return (
                    <div key={item.date} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground w-16">{dateStr}</span>
                      <div className="flex gap-4">
                        <span>전체: <span className="font-medium">{item.total}</span></span>
                        <span className="text-green-600">완료: {item.completed}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 border-t pt-6">
        <h4 className="text-base font-medium mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          시스템 성능 모니터링 ({getDateRangeLabel()})
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">API 사용량</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSystem ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">총 검색 요청</span>
                    <span className="font-semibold">{systemPerf?.apiUsage.totalSearches || 0}건</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">SOV 분석 큐</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSystem ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">성공률</span>
                    <span className={`font-semibold ${(systemPerf?.sovQueue.successRate || 0) >= 80 ? "text-green-600" : "text-yellow-600"}`}>
                      {systemPerf?.sovQueue.successRate || 0}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-green-600">완료: {systemPerf?.sovQueue.completed || 0}</span>
                    <span className="text-red-600">실패: {systemPerf?.sovQueue.failed || 0}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">리뷰 분석 큐</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSystem ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">성공률</span>
                    <span className={`font-semibold ${(systemPerf?.placeReviewQueue.successRate || 0) >= 80 ? "text-green-600" : "text-yellow-600"}`}>
                      {systemPerf?.placeReviewQueue.successRate || 0}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground border-t pt-2">
                    <span>현재 큐 상태</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-blue-600">대기: {systemPerf?.placeReviewQueue.pending || 0}</span>
                    <span className="text-yellow-600">진행: {systemPerf?.placeReviewQueue.processing || 0}</span>
                    <span className="text-red-600">실패: {systemPerf?.placeReviewQueue.failed || 0}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">일별 API 사용량 ({getDateRangeLabel()})</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSystem ? (
              <Skeleton className="h-24 w-full" />
            ) : systemPerf?.apiUsage.dailyUsage.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다</p>
            ) : (
              <div className="space-y-2">
                {systemPerf?.apiUsage.dailyUsage.map((item) => {
                  const maxSearches = Math.max(...(systemPerf?.apiUsage.dailyUsage.map(d => d.searches) || [1]));
                  const percentage = maxSearches > 0 ? Math.round((item.searches / maxSearches) * 100) : 0;
                  const dateStr = new Date(item.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
                  return (
                    <div key={item.date} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground w-16">{dateStr}</span>
                      <div className="flex items-center gap-2 flex-1 ml-2">
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${percentage}%` }} />
                        </div>
                        <span className="text-sm w-12 text-right">{item.searches}건</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
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

interface ApiUsageStats {
  byApiType: Array<{
    apiType: string;
    totalCalls: number;
    successCalls: number;
    failedCalls: number;
    totalTokens: number;
    avgResponseTime: number;
    successRate: number;
  }>;
  dailyTrend: Array<{
    date: string;
    apiType: string;
    count: number;
  }>;
  topUsers: Array<{
    userId: string;
    email: string;
    totalCalls: number;
    totalTokens: number;
  }>;
}

const API_TYPE_LABELS: Record<string, string> = {
  naver_search: "네이버 검색",
  naver_ad: "네이버 광고",
  openai: "OpenAI",
  browserless: "Browserless",
};

const API_TYPE_COLORS: Record<string, string> = {
  naver_search: "#22c55e",
  naver_ad: "#3b82f6",
  openai: "#8b5cf6",
  browserless: "#f59e0b",
};

function ApiUsageTab() {
  const [dateRange, setDateRange] = useState<string>("7days");
  
  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    switch (dateRange) {
      case "today": start.setHours(0,0,0,0); break;
      case "7days": start.setDate(start.getDate() - 7); break;
      case "30days": start.setDate(start.getDate() - 30); break;
      default: start.setDate(start.getDate() - 7);
    }
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  };
  
  const { startDate, endDate } = getDateRange();
  
  const { data: stats, isLoading } = useQuery<ApiUsageStats>({
    queryKey: ["admin-api-usage-stats", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await apiRequest("GET", `/api/admin/api-usage/stats?${params}`);
      return res.json();
    },
  });
  
  const chartData = useMemo(() => {
    if (!stats?.dailyTrend) return [];
    const grouped: Record<string, Record<string, number>> = {};
    stats.dailyTrend.forEach(d => {
      if (!grouped[d.date]) grouped[d.date] = {};
      grouped[d.date][d.apiType] = d.count;
    });
    return Object.entries(grouped)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, counts]) => ({
        date: new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
        ...counts,
      }));
  }, [stats?.dailyTrend]);
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Zap className="w-5 h-5" />
          API 사용량 모니터링
        </h2>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">오늘</SelectItem>
            <SelectItem value="7days">최근 7일</SelectItem>
            <SelectItem value="30days">최근 30일</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats?.byApiType.map(api => (
          <Card key={api.apiType}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: API_TYPE_COLORS[api.apiType] || "#888" }}
                />
                <span className="text-sm text-muted-foreground">
                  {API_TYPE_LABELS[api.apiType] || api.apiType}
                </span>
              </div>
              <p className="text-2xl font-bold">{api.totalCalls.toLocaleString()}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="text-green-600">성공 {api.successRate}%</span>
                {api.totalTokens > 0 && (
                  <span>| 토큰 {api.totalTokens.toLocaleString()}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                평균 응답 {api.avgResponseTime}ms
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">일별 API 호출 추이</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="naver_search" name="네이버 검색" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} />
                <Area type="monotone" dataKey="naver_ad" name="네이버 광고" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                <Area type="monotone" dataKey="openai" name="OpenAI" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                <Area type="monotone" dataKey="browserless" name="Browserless" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              데이터가 없습니다
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">사용자별 API 사용량 순위</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>순위</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead className="text-right">호출 횟수</TableHead>
                <TableHead className="text-right">토큰 사용량</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats?.topUsers.map((user, idx) => (
                <TableRow key={user.userId || idx}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell className="text-right">{user.totalCalls.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{user.totalTokens.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {(!stats?.topUsers || stats.topUsers.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    데이터가 없습니다
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

interface UserUsageStats {
  apiUsage: Array<{
    apiType: string;
    totalCalls: number;
    successCalls: number;
    failedCalls: number;
    totalTokens: number;
    avgResponseTime: number;
  }>;
  recentActivity: {
    searches: Array<{ id: string; searchType: string; keyword: string; createdAt: string }>;
    sovRuns: Array<{ id: string; marketKeyword: string; status: string; createdAt: string }>;
    placeReviews: Array<{ id: string; placeId: string; placeName: string | null; status: string; createdAt: string }>;
  };
  dailyActivity: Array<{ date: string; count: number }>;
  lastActivityAt: string | null;
}

function UserDetailModal({ 
  user, 
  open, 
  onClose 
}: { 
  user: AdminUser | null; 
  open: boolean; 
  onClose: () => void;
}) {
  const { data: usageStats, isLoading } = useQuery<UserUsageStats>({
    queryKey: ["admin-user-usage", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("No user");
      const res = await apiRequest("GET", `/api/admin/users/${user.id}/usage`);
      return res.json();
    },
    enabled: !!user && open,
  });
  
  if (!user) return null;
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            사용자 상세 정보
          </DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">역할</p>
              <p className="font-medium">{user.role}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">상태</p>
              <p className="font-medium">{user.status}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">이메일 인증</p>
              <p className="font-medium">{user.emailVerified ? "완료" : "미완료"}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">마지막 활동</p>
              <p className="font-medium text-sm">
                {usageStats?.lastActivityAt 
                  ? new Date(usageStats.lastActivityAt).toLocaleDateString('ko-KR')
                  : "없음"}
              </p>
            </div>
          </div>
          
          {isLoading ? (
            <Skeleton className="h-40" />
          ) : (
            <>
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  API 사용량
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {usageStats?.apiUsage.map(api => (
                    <div key={api.apiType} className="border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">
                        {API_TYPE_LABELS[api.apiType] || api.apiType}
                      </p>
                      <p className="text-lg font-bold">{api.totalCalls}</p>
                      <p className="text-xs text-muted-foreground">
                        토큰: {api.totalTokens.toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {(!usageStats?.apiUsage || usageStats.apiUsage.length === 0) && (
                    <p className="col-span-4 text-center text-muted-foreground py-4">
                      API 사용 기록이 없습니다
                    </p>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  최근 활동
                </h3>
                <Tabs defaultValue="searches" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="searches">검색 ({usageStats?.recentActivity.searches.length || 0})</TabsTrigger>
                    <TabsTrigger value="sov">SOV ({usageStats?.recentActivity.sovRuns.length || 0})</TabsTrigger>
                    <TabsTrigger value="reviews">리뷰 ({usageStats?.recentActivity.placeReviews.length || 0})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="searches" className="mt-3">
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {usageStats?.recentActivity.searches.map(s => (
                        <div key={s.id} className="flex justify-between items-center text-sm border-b pb-2">
                          <span className="truncate max-w-[200px]">{s.keyword}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(s.createdAt).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                      ))}
                      {(!usageStats?.recentActivity.searches || usageStats.recentActivity.searches.length === 0) && (
                        <p className="text-center text-muted-foreground py-4">없음</p>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="sov" className="mt-3">
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {usageStats?.recentActivity.sovRuns.map(s => (
                        <div key={s.id} className="flex justify-between items-center text-sm border-b pb-2">
                          <span className="truncate max-w-[200px]">{s.marketKeyword}</span>
                          <Badge variant={s.status === 'completed' ? 'default' : 'secondary'}>{s.status}</Badge>
                        </div>
                      ))}
                      {(!usageStats?.recentActivity.sovRuns || usageStats.recentActivity.sovRuns.length === 0) && (
                        <p className="text-center text-muted-foreground py-4">없음</p>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="reviews" className="mt-3">
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {usageStats?.recentActivity.placeReviews.map(s => (
                        <div key={s.id} className="flex justify-between items-center text-sm border-b pb-2">
                          <span className="truncate max-w-[200px]">{s.placeName || s.placeId}</span>
                          <Badge variant={s.status === 'completed' ? 'default' : 'secondary'}>{s.status}</Badge>
                        </div>
                      ))}
                      {(!usageStats?.recentActivity.placeReviews || usageStats.recentActivity.placeReviews.length === 0) && (
                        <p className="text-center text-muted-foreground py-4">없음</p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
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
            <TabsTrigger value="insights" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              인사이트
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-2">
              <Server className="w-4 h-4" />
              시스템 상태
            </TabsTrigger>
            <TabsTrigger value="api-usage" className="gap-2">
              <Zap className="w-4 h-4" />
              API 사용량
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
          <TabsContent value="insights">
            <InsightsTab />
          </TabsContent>
          <TabsContent value="system">
            <SystemStatusTab />
          </TabsContent>
          <TabsContent value="api-usage">
            <ApiUsageTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
