import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Layers, Mail, Lock, User, AlertCircle, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface AuthFormData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

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

async function registerRequest(data: AuthFormData) {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result.message || "회원가입 실패");
  }
  
  return result;
}

async function resendVerificationRequest(email: string) {
  const response = await fetch("/api/auth/resend-verification", {
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verified") === "true") {
      setSuccess("이메일 인증이 완료되었습니다. 로그인해주세요.");
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
      if (err.message.includes("이메일 인증이 필요")) {
        setNeedsVerification(true);
        setVerificationEmail(email);
      }
      setError(err.message);
    },
  });

  const registerMutation = useMutation({
    mutationFn: registerRequest,
    onSuccess: (result) => {
      setSuccess(result.message || "회원가입이 완료되었습니다. 이메일을 확인해주세요.");
      setActiveTab("login");
      setPassword("");
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const resendMutation = useMutation({
    mutationFn: resendVerificationRequest,
    onSuccess: () => {
      setSuccess("인증 이메일이 재발송되었습니다.");
      setNeedsVerification(false);
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

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (password.length < 8) {
      setError("비밀번호는 최소 8자 이상이어야 합니다");
      return;
    }
    
    registerMutation.mutate({ email, password, firstName, lastName });
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    forgotPasswordMutation.mutate(email);
  };

  const handleResendVerification = () => {
    setError(null);
    resendMutation.mutate(verificationEmail);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
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
          <p className="text-muted-foreground">네이버 검색 결과를 한눈에 파악하세요</p>
        </div>

        {needsVerification && (
          <Alert className="mb-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              이메일 인증이 필요합니다.
              <Button 
                variant="ghost" 
                className="px-1 h-auto text-yellow-600"
                onClick={handleResendVerification}
                disabled={resendMutation.isPending}
              >
                {resendMutation.isPending ? "발송 중..." : "인증 메일 재발송"}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4 border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">{success}</AlertDescription>
          </Alert>
        )}

        {showForgotPassword ? (
          <Card>
            <CardHeader>
              <CardTitle>비밀번호 찾기</CardTitle>
              <CardDescription>가입하신 이메일 주소를 입력해주세요</CardDescription>
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
                  type="submit" 
                  className="w-full" 
                  disabled={forgotPasswordMutation.isPending}
                >
                  {forgotPasswordMutation.isPending ? "발송 중..." : "재설정 메일 발송"}
                </Button>
                <Button 
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
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <CardHeader>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">로그인</TabsTrigger>
                  <TabsTrigger value="register">회원가입</TabsTrigger>
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
                          id="login-email"
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
                          id="login-password"
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
                      type="submit" 
                      className="w-full" 
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? "로그인 중..." : "로그인"}
                    </Button>
                    <Button 
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
                <form onSubmit={handleRegister}>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="first-name">이름</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="first-name"
                            type="text"
                            placeholder="이름"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last-name">성</Label>
                        <Input
                          id="last-name"
                          type="text"
                          placeholder="성"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email">이메일</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="register-email"
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
                      <Label htmlFor="register-password">비밀번호</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="register-password"
                          type="password"
                          placeholder="최소 8자 이상"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10"
                          minLength={8}
                          required
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">최소 8자 이상 입력해주세요</p>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? "가입 중..." : "회원가입"}
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          <a href="/" className="hover:text-primary">← 홈으로 돌아가기</a>
        </p>
      </div>
    </div>
  );
}
