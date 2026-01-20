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

function UsersTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editStatus, setEditStatus] = useState("");
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
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(user)}>
                    수정
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
      user_solution_revoke: "솔루션 해제",
    };
    return labels[action] || action;
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
                <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                  {log.details || "-"}
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
        </Tabs>
      </main>
    </div>
  );
}
