import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Key, AlertTriangle, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface SystemApiKey {
  id: string;
  name: string;
  clientId: string;
  hasClientSecret: boolean;
  dailyLimit: string;
  trendDailyLimit: string;
  priority: string;
  isActive: string;
  dailyUsage: number;
  quotaStatus: {
    status: "ok" | "warning" | "critical" | "exceeded";
    percentageUsed: number;
  };
  trendDailyUsage: number;
  trendQuotaStatus: {
    status: "ok" | "warning" | "critical" | "exceeded";
    percentageUsed: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface SystemApiKeySummary {
  totalKeys: number;
  activeKeys: number;
  totalLimit: number;
  totalUsed: number;
  totalRemaining: number;
  allExhausted: boolean;
  trendTotalLimit: number;
  trendTotalUsed: number;
  trendTotalRemaining: number;
  trendAllExhausted: boolean;
}

interface SystemApiKeysResponse {
  keys: SystemApiKey[];
  summary: SystemApiKeySummary;
}

interface KeyFormData {
  name: string;
  clientId: string;
  clientSecret: string;
  dailyLimit: string;
  trendDailyLimit: string;
  priority: string;
  isActive: string;
}

const initialFormData: KeyFormData = {
  name: "",
  clientId: "",
  clientSecret: "",
  dailyLimit: "25000",
  trendDailyLimit: "1000",
  priority: "0",
  isActive: "true",
};

export function SystemApiKeysTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.role === "superadmin";

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SystemApiKey | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SystemApiKey | null>(null);
  const [formData, setFormData] = useState<KeyFormData>(initialFormData);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/system-api-keys"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/system-api-keys");
      return res.json() as Promise<SystemApiKeysResponse>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: KeyFormData) => {
      const res = await apiRequest("POST", "/api/admin/system-api-keys", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "생성 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "시스템 API 키가 추가되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-api-keys"] });
      setIsAddModalOpen(false);
      setFormData(initialFormData);
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<KeyFormData> }) => {
      const res = await apiRequest("PUT", `/api/admin/system-api-keys/${id}`, data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "수정 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "시스템 API 키가 수정되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-api-keys"] });
      setEditTarget(null);
      setFormData(initialFormData);
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/system-api-keys/${id}`);
      if (!res.ok) throw new Error("삭제 실패");
    },
    onSuccess: () => {
      toast({ title: "시스템 API 키가 삭제되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-api-keys"] });
      setDeleteTarget(null);
    },
    onError: () => {
      toast({ title: "삭제 실패", variant: "destructive" });
    },
  });

  const handleOpenAddModal = () => {
    setFormData(initialFormData);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (key: SystemApiKey) => {
    setFormData({
      name: key.name,
      clientId: key.clientId,
      clientSecret: "",
      dailyLimit: key.dailyLimit,
      trendDailyLimit: key.trendDailyLimit || "1000",
      priority: key.priority,
      isActive: key.isActive,
    });
    setEditTarget(key);
  };

  const handleSubmitAdd = () => {
    if (!formData.name || !formData.clientId || !formData.clientSecret) {
      toast({ title: "필수 항목을 입력하세요", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleSubmitEdit = () => {
    if (!editTarget) return;
    const updateData: Partial<KeyFormData> = {
      name: formData.name,
      dailyLimit: formData.dailyLimit,
      trendDailyLimit: formData.trendDailyLimit,
      priority: formData.priority,
      isActive: formData.isActive,
    };
    if (formData.clientId !== editTarget.clientId) {
      updateData.clientId = formData.clientId;
    }
    if (formData.clientSecret) {
      updateData.clientSecret = formData.clientSecret;
    }
    updateMutation.mutate({ id: editTarget.id, data: updateData });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ok":
        return <Badge variant="outline" className="text-green-600 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />정상</Badge>;
      case "warning":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-300"><AlertTriangle className="w-3 h-3 mr-1" />경고</Badge>;
      case "critical":
        return <Badge variant="outline" className="text-orange-600 border-orange-300"><AlertTriangle className="w-3 h-3 mr-1" />위험</Badge>;
      case "exceeded":
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />소진</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">검색 API</span>
                <Badge variant="outline" className="text-xs">
                  {summary.activeKeys}개 활성
                </Badge>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold">
                  {summary.totalLimit > 0 ? Math.round((summary.totalUsed / summary.totalLimit) * 100) : 0}%
                </span>
                <span className="text-sm text-muted-foreground">
                  {summary.totalUsed.toLocaleString()} / {summary.totalLimit.toLocaleString()}
                </span>
              </div>
              <Progress 
                value={summary.totalLimit > 0 ? (summary.totalUsed / summary.totalLimit) * 100 : 0} 
                className="h-2"
              />
              <div className="text-xs text-muted-foreground mt-1">
                잔여 {summary.totalRemaining.toLocaleString()}건
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">데이터랩 API</span>
                <Badge variant="outline" className="text-xs">
                  일일 한도
                </Badge>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold">
                  {(summary.trendTotalLimit ?? 0) > 0 ? Math.round(((summary.trendTotalUsed ?? 0) / (summary.trendTotalLimit ?? 1)) * 100) : 0}%
                </span>
                <span className="text-sm text-muted-foreground">
                  {(summary.trendTotalUsed ?? 0).toLocaleString()} / {(summary.trendTotalLimit ?? 0).toLocaleString()}
                </span>
              </div>
              <Progress 
                value={(summary.trendTotalLimit ?? 0) > 0 ? ((summary.trendTotalUsed ?? 0) / (summary.trendTotalLimit ?? 1)) * 100 : 0} 
                className="h-2"
              />
              <div className="text-xs text-muted-foreground mt-1">
                잔여 {(summary.trendTotalRemaining ?? 0).toLocaleString()}건
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="w-5 h-5" />
            시스템 API 키 목록
          </CardTitle>
          {isSuperAdmin && (
            <Button onClick={handleOpenAddModal} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              키 추가
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>Client ID</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>검색 API</TableHead>
                <TableHead>데이터랩 API</TableHead>
                <TableHead>우선순위</TableHead>
                {isSuperAdmin && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    {isSuperAdmin && <TableCell><Skeleton className="h-4 w-16" /></TableCell>}
                  </TableRow>
                ))
              ) : data?.keys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isSuperAdmin ? 7 : 6} className="text-center text-muted-foreground py-8">
                    등록된 시스템 API 키가 없습니다
                  </TableCell>
                </TableRow>
              ) : data?.keys.map((key) => (
                <TableRow key={key.id} className={key.isActive !== "true" ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell className="font-mono text-sm">{key.clientId}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {key.isActive === "true" ? (
                        getStatusBadge(key.quotaStatus.status)
                      ) : (
                        <Badge variant="secondary">비활성</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {key.dailyUsage.toLocaleString()} / {parseInt(key.dailyLimit).toLocaleString()}
                      </div>
                      <Progress 
                        value={key.quotaStatus.percentageUsed} 
                        className="h-1.5 w-20"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {(key.trendDailyUsage ?? 0).toLocaleString()} / {parseInt(key.trendDailyLimit || "1000").toLocaleString()}
                      </div>
                      <Progress 
                        value={key.trendQuotaStatus?.percentageUsed ?? 0} 
                        className="h-1.5 w-20"
                      />
                    </div>
                  </TableCell>
                  <TableCell>{key.priority}</TableCell>
                  {isSuperAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditModal(key)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(key)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>시스템 API 키 추가</DialogTitle>
            <DialogDescription>
              모든 사용자가 공유하는 시스템 API 키를 추가합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>이름 *</Label>
              <Input 
                placeholder="예: 기본 키 1" 
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Client ID *</Label>
              <Input 
                placeholder="네이버 개발자 센터에서 발급받은 Client ID"
                value={formData.clientId}
                onChange={(e) => setFormData(prev => ({ ...prev, clientId: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Client Secret *</Label>
              <Input 
                type="password"
                placeholder="네이버 개발자 센터에서 발급받은 Client Secret"
                value={formData.clientSecret}
                onChange={(e) => setFormData(prev => ({ ...prev, clientSecret: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>검색 API 일일 한도</Label>
                <Input 
                  type="number"
                  value={formData.dailyLimit}
                  onChange={(e) => setFormData(prev => ({ ...prev, dailyLimit: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>데이터랩 API 일일 한도</Label>
                <Input 
                  type="number"
                  value={formData.trendDailyLimit}
                  onChange={(e) => setFormData(prev => ({ ...prev, trendDailyLimit: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>우선순위 (낮을수록 먼저 사용)</Label>
              <Input 
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>취소</Button>
            <Button onClick={handleSubmitAdd} disabled={createMutation.isPending}>
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>시스템 API 키 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>이름</Label>
              <Input 
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input 
                value={formData.clientId}
                onChange={(e) => setFormData(prev => ({ ...prev, clientId: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Client Secret (변경 시에만 입력)</Label>
              <Input 
                type="password"
                placeholder="변경하지 않으려면 비워두세요"
                value={formData.clientSecret}
                onChange={(e) => setFormData(prev => ({ ...prev, clientSecret: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>검색 API 일일 한도</Label>
                <Input 
                  type="number"
                  value={formData.dailyLimit}
                  onChange={(e) => setFormData(prev => ({ ...prev, dailyLimit: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>데이터랩 API 일일 한도</Label>
                <Input 
                  type="number"
                  value={formData.trendDailyLimit}
                  onChange={(e) => setFormData(prev => ({ ...prev, trendDailyLimit: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>우선순위</Label>
                <Input 
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch 
                  checked={formData.isActive === "true"}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked ? "true" : "false" }))}
                />
                <Label>활성화</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>취소</Button>
            <Button onClick={handleSubmitEdit} disabled={updateMutation.isPending}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>시스템 API 키 삭제</DialogTitle>
            <DialogDescription>
              이 API 키를 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              이름: <span className="font-medium text-foreground">{deleteTarget?.name}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Client ID: <span className="font-mono">{deleteTarget?.clientId}</span>
            </p>
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
