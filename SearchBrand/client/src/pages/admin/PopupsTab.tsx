import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { TabPageLayout, FilterRow, FilterField } from "./TabPageLayout";
import { TableLoading, EmptyState } from "./components/StateComponents";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Eye, EyeOff, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Popup } from "@shared/schema";

interface PopupsResponse {
  popups: Popup[];
  total: number;
  limit: number;
  offset: number;
}

const TARGET_PAGE_OPTIONS = [
  { value: "all", label: "전체 페이지" },
  { value: "landing", label: "랜딩 페이지" },
  { value: "dashboard", label: "대시보드" },
  { value: "place-review", label: "플레이스 리뷰" },
];

const getEmptyPopup = () => ({
  content: "",
  imageUrl: "",
  startDate: new Date().toISOString().slice(0, 16),
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  targetPage: "all" as const,
  priority: 0,
  showDontShowToday: true,
  showNeverShow: false,
  isActive: true,
});

export function PopupsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPopup, setEditingPopup] = useState<Popup | null>(null);
  const [formData, setFormData] = useState(getEmptyPopup());
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/popups", page, activeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String((page - 1) * pageSize),
      });
      if (activeFilter !== "all") params.append("isActive", activeFilter);
      
      const res = await apiRequest("GET", `/api/admin/popups?${params}`);
      return res.json() as Promise<PopupsResponse>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/admin/popups", {
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/popups"] });
      setIsDialogOpen(false);
      setFormData(getEmptyPopup());
      toast({ title: "팝업이 생성되었습니다" });
    },
    onError: () => {
      toast({ title: "팝업 생성 실패", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await apiRequest("PATCH", `/api/admin/popups/${id}`, {
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/popups"] });
      setIsDialogOpen(false);
      setEditingPopup(null);
      setFormData(getEmptyPopup());
      toast({ title: "팝업이 수정되었습니다" });
    },
    onError: () => {
      toast({ title: "팝업 수정 실패", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/popups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/popups"] });
      toast({ title: "팝업이 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "팝업 삭제 실패", variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/popups/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/popups"] });
    },
  });

  const handleCreate = () => {
    setEditingPopup(null);
    setFormData(getEmptyPopup());
    setIsDialogOpen(true);
  };

  const handleEdit = (popup: Popup) => {
    setEditingPopup(popup);
    setFormData({
      content: popup.content,
      imageUrl: popup.imageUrl || "",
      startDate: new Date(popup.startDate).toISOString().slice(0, 16),
      endDate: new Date(popup.endDate).toISOString().slice(0, 16),
      targetPage: popup.targetPage as any,
      priority: popup.priority,
      showDontShowToday: popup.showDontShowToday,
      showNeverShow: popup.showNeverShow,
      isActive: popup.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingPopup) {
      updateMutation.mutate({ id: editingPopup.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("이 팝업을 삭제하시겠습니까?")) {
      deleteMutation.mutate(id);
    }
  };

  const formatDate = (dateStr: string | Date) => {
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isPopupActive = (popup: Popup) => {
    const now = new Date();
    return popup.isActive && new Date(popup.startDate) <= now && new Date(popup.endDate) >= now;
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <TabPageLayout
      summary={data ? [
        { label: "전체", value: data.total },
        { label: "활성", value: data.popups.filter(p => p.isActive).length },
      ] : undefined}
      filterContent={
        <FilterRow 
          onApply={() => setPage(1)} 
          onReset={() => { setActiveFilter("all"); setPage(1); }}
        >
          <FilterField label="상태">
            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="true">활성</SelectItem>
                <SelectItem value="false">비활성</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
        </FilterRow>
      }
      actions={
        <Button onClick={handleCreate} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          팝업 생성
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">팝업 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableLoading />
          ) : !data?.popups.length ? (
            <EmptyState title="등록된 팝업이 없습니다" description="새 팝업을 생성해주세요" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>상태</TableHead>
                    <TableHead>노출 페이지</TableHead>
                    <TableHead>기간</TableHead>
                    <TableHead>우선순위</TableHead>
                    <TableHead>옵션</TableHead>
                    <TableHead className="text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.popups.map((popup) => (
                    <TableRow key={popup.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={popup.isActive}
                            onCheckedChange={(checked) => 
                              toggleActiveMutation.mutate({ id: popup.id, isActive: checked })
                            }
                          />
                          {isPopupActive(popup) ? (
                            <Badge variant="default" className="bg-green-500">노출중</Badge>
                          ) : popup.isActive ? (
                            <Badge variant="secondary">대기중</Badge>
                          ) : (
                            <Badge variant="outline">비활성</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {TARGET_PAGE_OPTIONS.find(o => o.value === popup.targetPage)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(popup.startDate)} ~ {formatDate(popup.endDate)}
                        </div>
                      </TableCell>
                      <TableCell>{popup.priority}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {popup.showDontShowToday && (
                            <Badge variant="outline" className="text-xs">오늘안보기</Badge>
                          )}
                          {popup.showNeverShow && (
                            <Badge variant="outline" className="text-xs">다시안보기</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(popup)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDelete(popup.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPopup ? "팝업 수정" : "새 팝업 생성"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="content">내용 (HTML 지원) *</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="팝업 내용을 입력하세요"
                rows={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imageUrl">이미지 URL (선택)</Label>
              <Input
                id="imageUrl"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">시작일시 *</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">종료일시 *</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetPage">노출 페이지</Label>
                <Select 
                  value={formData.targetPage} 
                  onValueChange={(v) => setFormData({ ...formData, targetPage: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_PAGE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">우선순위 (높을수록 먼저 표시)</Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="showDontShowToday">"오늘 하루 안 보기" 옵션 표시</Label>
                <Switch
                  id="showDontShowToday"
                  checked={formData.showDontShowToday}
                  onCheckedChange={(checked) => setFormData({ ...formData, showDontShowToday: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="showNeverShow">"다시 보지 않기" 옵션 표시</Label>
                <Switch
                  id="showNeverShow"
                  checked={formData.showNeverShow}
                  onCheckedChange={(checked) => setFormData({ ...formData, showNeverShow: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">활성화</Label>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>취소</Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.content || createMutation.isPending || updateMutation.isPending}
            >
              {editingPopup ? "수정" : "생성"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TabPageLayout>
  );
}
