import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Layers, Lock, AlertCircle, CheckCircle } from "lucide-react";

async function resetPasswordRequest(data: { token: string; password: string }) {
  const response = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result.message || "비밀번호 재설정 실패");
  }
  
  return result;
}

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError("유효하지 않은 재설정 링크입니다");
    }
  }, []);

  const resetMutation = useMutation({
    mutationFn: resetPasswordRequest,
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("비밀번호는 최소 8자 이상이어야 합니다");
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다");
      return;
    }

    resetMutation.mutate({ token, password });
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                <Layers className="w-7 h-7 text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold">통합 모니터링</span>
            </div>
          </div>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle>비밀번호 재설정 완료</CardTitle>
              <CardDescription>
                새 비밀번호로 로그인할 수 있습니다
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button className="w-full" onClick={() => navigate("/auth")}>
                로그인하기
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <Layers className="w-7 h-7 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">통합 모니터링</span>
          </div>
          <p className="text-muted-foreground">새 비밀번호를 설정해주세요</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>비밀번호 재설정</CardTitle>
            <CardDescription>새 비밀번호를 입력해주세요</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">새 비밀번호</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="최소 8자 이상"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    minLength={8}
                    required
                    disabled={!token}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">비밀번호 확인</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="비밀번호 다시 입력"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    minLength={8}
                    required
                    disabled={!token}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={resetMutation.isPending || !token}
              >
                {resetMutation.isPending ? "재설정 중..." : "비밀번호 재설정"}
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full"
                onClick={() => navigate("/auth")}
              >
                로그인으로 돌아가기
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
