import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Lock, AlertCircle, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

async function loginRequest(data: { email: string; password: string }) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "로그인 실패");
  }

  return result;
}

async function startRegistrationRequest(email: string) {
  const response = await fetch("/api/auth/start-registration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "회원가입 요청 실패");
  }

  return result;
}

async function resendRegistrationRequest(email: string) {
  const response = await fetch("/api/auth/resend-registration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "재발송 실패");
  }

  return result;
}

async function forgotPasswordRequest(email: string) {
  const response = await fetch("/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "요청 실패");
  }

  return result;
}

export default function AuthPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading } = useAuth();

  const [activeTab, setActiveTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showEmailSent, setShowEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verified") === "true") {
      setSuccess("회원가입이 완료되었습니다. 로그인해주세요.");
      window.history.replaceState({}, "", window.location.pathname);
    }
    const errorParam = params.get("error");
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate("/");
    }
  }, [isAuthenticated, isLoading, navigate]);

  const loginMutation = useMutation({
    mutationFn: loginRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      navigate("/");
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const startRegistrationMutation = useMutation({
    mutationFn: startRegistrationRequest,
    onSuccess: (_, email) => {
      setSentEmail(email);
      setShowEmailSent(true);
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const resendMutation = useMutation({
    mutationFn: resendRegistrationRequest,
    onSuccess: () => {
      setSuccess("인증 이메일이 재발송되었습니다.");
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: forgotPasswordRequest,
    onSuccess: () => {
      setSuccess("비밀번호 재설정 이메일이 발송되었습니다.");
      setShowForgotPassword(false);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    loginMutation.mutate({ email, password });
  };

  const handleStartRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startRegistrationMutation.mutate(email);
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    forgotPasswordMutation.mutate(email);
  };

  const handleResend = () => {
    setError(null);
    setSuccess(null);
    resendMutation.mutate(sentEmail);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (showEmailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex flex-col items-center mb-4">
              <svg
                className="w-20 h-20 shrink-0"
                viewBox="0 0 512 512"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="224"
                  cy="224"
                  r="120"
                  stroke="#1D4ED8"
                  strokeWidth="24"
                />
                <circle
                  cx="224"
                  cy="224"
                  r="72"
                  stroke="#22D3EE"
                  strokeWidth="16"
                />
                <path
                  d="M318 318L408 408"
                  stroke="#1D4ED8"
                  strokeWidth="28"
                  strokeLinecap="round"
                />
                <path
                  d="M344 92C396 122 432 176 432 240"
                  stroke="#22D3EE"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
              </svg>
              <div className="flex flex-col items-center text-center">
                <span
                  className="text-[30px] font-bold"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    letterSpacing: "-0.8px",
                  }}
                >
                  <span style={{ color: "#1D4ED8" }}>Search</span>
                  <span style={{ color: "#22D3EE" }}>Brand</span>
                </span>
                <span
                  className="text-[11px] mt-0.5"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    color: "#94A3B8",
                    letterSpacing: "0.2px",
                    opacity: 0.8,
                  }}
                >
                  powered by Glitzy
                </span>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                {success}
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
                <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle>이메일을 확인해주세요</CardTitle>
              <CardDescription>
                <span className="font-medium text-foreground">{sentEmail}</span>
                <br />위 주소로 인증 이메일을 발송했습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center text-sm text-muted-foreground">
              <p>이메일의 링크를 클릭하여 회원가입을 완료해주세요.</p>
              <p className="mt-2">이메일이 도착하지 않았나요?</p>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button
                id="auth-btn-resend"
                variant="outline"
                className="w-full"
                onClick={handleResend}
                disabled={resendMutation.isPending}
              >
                {resendMutation.isPending ? "발송 중..." : "인증 이메일 재발송"}
              </Button>
              <Button
                id="auth-btn-change-email"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setShowEmailSent(false);
                  setEmail("");
                }}
              >
                다른 이메일로 가입하기
              </Button>
            </CardFooter>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-6">
            <a id="auth-link-home-sent" href="/" className="hover:text-primary">
              ← 홈으로 돌아가기
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex flex-col items-center mb-4">
            <svg
              className="w-20 h-20 shrink-0"
              viewBox="0 0 512 512"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="224"
                cy="224"
                r="120"
                stroke="#1D4ED8"
                strokeWidth="24"
              />
              <circle
                cx="224"
                cy="224"
                r="72"
                stroke="#22D3EE"
                strokeWidth="16"
              />
              <path
                d="M318 318L408 408"
                stroke="#1D4ED8"
                strokeWidth="28"
                strokeLinecap="round"
              />
              <path
                d="M344 92C396 122 432 176 432 240"
                stroke="#22D3EE"
                strokeWidth="16"
                strokeLinecap="round"
              />
            </svg>
            <div className="flex flex-col items-center text-center">
              <span
                className="text-[30px] font-bold"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  letterSpacing: "-0.8px",
                }}
              >
                <span style={{ color: "#1D4ED8" }}>Search</span>
                <span style={{ color: "#22D3EE" }}>Brand</span>
              </span>
              <span
                className="text-[11px] mt-0.5"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  color: "#94A3B8",
                  letterSpacing: "0.2px",
                  opacity: 0.8,
                }}
              >
                powered by Glitzy
              </span>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4 border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              {success}
            </AlertDescription>
          </Alert>
        )}

        {showForgotPassword ? (
          <Card>
            <CardHeader>
              <CardTitle>비밀번호 찾기</CardTitle>
              <CardDescription>
                가입하신 이메일 주소를 입력해주세요
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleForgotPassword}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">이메일</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="이메일 주소"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button
                  id="auth-btn-reset-password"
                  type="submit"
                  className="w-full"
                  disabled={forgotPasswordMutation.isPending}
                >
                  {forgotPasswordMutation.isPending
                    ? "발송 중..."
                    : "재설정 메일 발송"}
                </Button>
                <Button
                  id="auth-link-back-login"
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowForgotPassword(false)}
                >
                  로그인으로 돌아가기
                </Button>
              </CardFooter>
            </form>
          </Card>
        ) : (
          <Card>
            <Tabs
              value={activeTab}
              onValueChange={(value) => {
                setActiveTab(value);
                setError(null);
                setSuccess(null);
              }}
            >
              <CardHeader>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger id="auth-tab-login" value="login">로그인</TabsTrigger>
                  <TabsTrigger id="auth-tab-register" value="register">회원가입</TabsTrigger>
                </TabsList>
              </CardHeader>

              <TabsContent value="login">
                <form onSubmit={handleLogin}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">이메일</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="auth-input-login-email"
                          type="email"
                          placeholder="이메일 주소"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">비밀번호</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="auth-input-login-password"
                          type="password"
                          placeholder="비밀번호"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-4">
                    <Button
                      id="auth-btn-login"
                      type="submit"
                      className="w-full"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? "로그인 중..." : "로그인"}
                    </Button>
                    <Button
                      id="auth-link-forgot"
                      type="button"
                      variant="ghost"
                      className="text-sm text-muted-foreground"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      비밀번호를 잊으셨나요?
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleStartRegistration}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-email">이메일</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="auth-input-register-email"
                          type="email"
                          placeholder="이메일 주소"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      입력하신 이메일로 인증 링크가 발송됩니다.
                      <br />
                      이메일 인증 후 비밀번호를 설정하여 가입이 완료됩니다.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button
                      id="auth-btn-register"
                      type="submit"
                      className="w-full"
                      disabled={startRegistrationMutation.isPending}
                    >
                      {startRegistrationMutation.isPending
                        ? "발송 중..."
                        : "인증 이메일 받기"}
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          <a id="auth-link-home" href="/" className="hover:text-primary">
            ← 홈으로 돌아가기
          </a>
        </p>
      </div>
    </div>
  );
}
