import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  User, 
  Mail, 
  Key, 
  BarChart3, 
  Calendar,
  CheckCircle2,
  XCircle,
  ArrowLeft
} from "lucide-react";
import { Link } from "wouter";

interface ApiKeyStatus {
  clientId: string;
  hasClientSecret: boolean;
  updatedAt: string | null;
}

interface SovRun {
  id: string;
  status: string;
  marketKeyword: string;
  brands: string[];
  createdAt: string;
}

export default function ProfilePage() {
  const { user } = useAuth();

  const { data: apiKey, isLoading: apiKeyLoading } = useQuery<ApiKeyStatus | null>({
    queryKey: ["/api/api-keys"],
  });

  const { data: sovRuns, isLoading: sovRunsLoading } = useQuery<SovRun[]>({
    queryKey: ["/api/sov/runs"],
  });

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] || "";
    const last = lastName?.[0] || "";
    return (first + last).toUpperCase() || "U";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const completedRuns = sovRuns?.filter(r => r.status === "completed") || [];
  const recentRuns = sovRuns?.slice(0, 5) || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              대시보드로 돌아가기
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
                <Key className="w-5 h-5" />
                API 키 상태
              </CardTitle>
              <CardDescription>
                네이버 검색 API 연동 상태
              </CardDescription>
            </CardHeader>
            <CardContent>
              {apiKeyLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : apiKey ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-700 dark:text-green-400">API 키 등록됨</p>
                        <p className="text-sm text-muted-foreground">
                          Client ID: {apiKey.clientId.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                    {apiKey.updatedAt && (
                      <p className="text-xs text-muted-foreground">
                        최종 수정: {formatDate(apiKey.updatedAt)}
                      </p>
                    )}
                  </div>
                  <Link href="/">
                    <Button variant="outline" size="sm">
                      API 키 수정하기
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                    <XCircle className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-700 dark:text-amber-400">API 키 미등록</p>
                      <p className="text-sm text-muted-foreground">
                        네이버 검색을 사용하려면 API 키를 등록하세요
                      </p>
                    </div>
                  </div>
                  <Link href="/">
                    <Button size="sm">
                      API 키 등록하기
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                SOV 분석 기록
              </CardTitle>
              <CardDescription>
                브랜드 점유율 분석 이력
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sovRunsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : sovRuns && sovRuns.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold text-primary">{sovRuns.length}</p>
                      <p className="text-sm text-muted-foreground">전체 분석</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{completedRuns.length}</p>
                      <p className="text-sm text-muted-foreground">완료됨</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold text-muted-foreground">
                        {new Set(sovRuns.flatMap(r => r.brands)).size}
                      </p>
                      <p className="text-sm text-muted-foreground">분석한 브랜드</p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-3">최근 분석</h4>
                    <div className="space-y-2">
                      {recentRuns.map((run) => (
                        <div key={run.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge variant={run.status === "completed" ? "default" : "secondary"}>
                              {run.status === "completed" ? "완료" : run.status === "failed" ? "실패" : "진행중"}
                            </Badge>
                            <span className="font-medium">{run.marketKeyword}</span>
                            <span className="text-sm text-muted-foreground">
                              ({run.brands.length}개 브랜드)
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {formatDate(run.createdAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">아직 분석 기록이 없습니다</p>
                  <Link href="/">
                    <Button variant="outline" size="sm" className="mt-4">
                      첫 분석 시작하기
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
