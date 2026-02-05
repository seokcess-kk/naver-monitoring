import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  User, 
  Mail, 
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Search,
  TrendingUp,
  AlertTriangle,
  UserX
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface SearchStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  byType: { searchType: string; count: number }[];
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [password, setPassword] = useState("");

  const { data: searchStats, isLoading: statsLoading } = useQuery<SearchStats>({
    queryKey: ["/api/search-stats"],
  });

  const withdrawMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await apiRequest("POST", "/api/auth/withdraw", { password });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "탈퇴 완료",
        description: "30일 이내에 로그인하시면 계정을 복구할 수 있습니다.",
      });
      logout();
      navigate("/");
    },
    onError: (error: Error) => {
      toast({
        title: "탈퇴 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleWithdraw = () => {
    if (!password) {
      toast({
        title: "비밀번호 필요",
        description: "비밀번호를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }
    setWithdrawDialogOpen(false);
    setConfirmDialogOpen(true);
  };

  const confirmWithdraw = () => {
    withdrawMutation.mutate(password);
    setConfirmDialogOpen(false);
    setPassword("");
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] || "";
    const last = lastName?.[0] || "";
    return (first + last).toUpperCase() || "U";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Link href="/">
            <Button id="profile-btn-back" variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              메인으로 돌아가기
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                프로필 정보
              </CardTitle>
              <CardDescription>
                계정 기본 정보를 확인하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-violet-600 text-primary-foreground text-2xl font-semibold">
                    {getInitials(user?.firstName, user?.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <div>
                    <p className="text-lg font-semibold">
                      {user?.firstName || ""} {user?.lastName || ""}
                      {!user?.firstName && !user?.lastName && "사용자"}
                    </p>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span>{user?.email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {user?.emailVerified ? (
                      <Badge variant="outline" className="text-green-600 border-green-300">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        이메일 인증됨
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        <XCircle className="w-3 h-3 mr-1" />
                        이메일 미인증
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                검색 사용량
              </CardTitle>
              <CardDescription>
                기간별 검색 횟수 통계 (추후 과금 기준)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : searchStats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                      <p className="text-2xl font-bold text-blue-600">{searchStats.today}</p>
                      <p className="text-sm text-muted-foreground">오늘</p>
                    </div>
                    <div className="text-center p-4 bg-violet-50 dark:bg-violet-950/20 rounded-lg border border-violet-200 dark:border-violet-900">
                      <p className="text-2xl font-bold text-violet-600">{searchStats.thisWeek}</p>
                      <p className="text-sm text-muted-foreground">이번 주</p>
                    </div>
                    <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <p className="text-2xl font-bold text-primary">{searchStats.thisMonth}</p>
                      <p className="text-sm text-muted-foreground">이번 달</p>
                    </div>
                  </div>
                  {searchStats.byType.length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        이번 달 검색 유형별 통계
                      </h4>
                      <div className="flex gap-4">
                        {searchStats.byType.map((item) => (
                          <div key={item.searchType} className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
                            <Badge variant="outline" className="text-xs">
                              {item.searchType === "unified" ? "통합검색" : item.searchType}
                            </Badge>
                            <span className="font-medium">{item.count}회</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">검색 기록이 없습니다</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        <Card className="border-destructive/30 mt-6">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <UserX className="w-5 h-5" />
              계정 탈퇴
            </CardTitle>
            <CardDescription>
              탈퇴 시 30일간의 유예 기간이 있습니다. 유예 기간 중 로그인하면 계정을 복구할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-destructive">탈퇴 전 확인사항</p>
                    <ul className="mt-2 space-y-1 text-muted-foreground">
                      <li>- 등록된 API 키와 설정이 삭제됩니다</li>
                      <li>- 30일 유예 기간 후 모든 데이터가 익명화/삭제됩니다</li>
                      <li>- 30일 이내 재로그인 시 계정 복구 가능</li>
                      <li>- 동일 이메일로 30일간 재가입이 제한됩니다</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
                <DialogTrigger asChild>
                  <Button id="profile-btn-withdraw" variant="destructive" className="w-full">
                    <UserX className="w-4 h-4 mr-2" />
                    회원 탈퇴
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>회원 탈퇴</DialogTitle>
                    <DialogDescription>
                      정말 탈퇴하시겠습니까? 본인 확인을 위해 비밀번호를 입력해주세요.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="password">비밀번호</Label>
                      <Input
                        id="profile-input-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="비밀번호를 입력하세요"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button id="profile-btn-withdraw-cancel" variant="outline" onClick={() => setWithdrawDialogOpen(false)}>
                      취소
                    </Button>
                    <Button 
                      id="profile-btn-withdraw-confirm"
                      variant="destructive" 
                      onClick={handleWithdraw}
                      disabled={withdrawMutation.isPending}
                    >
                      탈퇴 진행
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>정말 탈퇴하시겠습니까?</AlertDialogTitle>
                    <AlertDialogDescription>
                      이 작업은 되돌릴 수 없습니다. 30일 이내에 로그인하시면 계정을 복구할 수 있지만, 
                      그 이후에는 모든 데이터가 영구적으로 삭제됩니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setPassword("")}>취소</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={confirmWithdraw}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      탈퇴 확인
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
