import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  BarChart3,
  Shield,
  Zap,
  Globe,
  ArrowRight,
  PieChart,
  Key,
  Mail,
  Lock,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      question: "API 키는 어떻게 보관되나요?",
      answer:
        "고객님의 네이버 API 키는 AES-256-GCM 방식으로 암호화되어 안전하게 저장됩니다. 서버에서도 복호화된 키를 로그에 남기지 않습니다.",
    },
    {
      question: "어떤 채널을 분석하나요?",
      answer:
        "네이버 블로그, 카페, 지식iN, 뉴스 4개 채널의 API 검색 결과와 스마트블록(플레이스, VIEW, 뉴스블록) 크롤링 결과를 통합 분석합니다.",
    },
    {
      question: "SOV 분석은 어떻게 작동하나요?",
      answer:
        "시장 키워드 검색 결과에서 스마트블록 콘텐츠를 수집하고, OpenAI 임베딩을 활용해 브랜드 관련성을 분석하여 노출 점유율을 계산합니다.",
    },
    {
      question: "무료로 사용할 수 있나요?",
      answer:
        "네, 기본 기능은 무료로 제공됩니다. 네이버 개발자 센터에서 발급받은 API 키만 등록하시면 바로 시작할 수 있습니다.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b glass-card">
        <div className="container mx-auto px-4 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center">
            <svg
              className="w-10 h-10 md:w-12 md:h-12 shrink-0"
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
            <div
              className="flex flex-col items-end relative"
              style={{ top: "3px" }}
            >
              <span
                className="text-lg md:text-xl font-bold"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  letterSpacing: "-0.8px",
                }}
              >
                <span style={{ color: "#1D4ED8" }}>Search</span>
                <span style={{ color: "#22D3EE" }}>Brand</span>
              </span>
              <span
                className="text-[10px] md:text-[11px] mt-0.5"
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
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="hidden sm:inline-flex"
            >
              <a href="#features">기능</a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="hidden sm:inline-flex"
            >
              <a href="#how-it-works">사용법</a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="hidden sm:inline-flex"
            >
              <a href="#faq">FAQ</a>
            </Button>
            <Button asChild size="sm" data-testid="button-login">
              <a href="/auth">로그인</a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="py-12 md:py-20 lg:py-28 overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div className="space-y-6 md:space-y-8 animate-fade-in-up">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs md:text-sm font-medium">
                  <Zap className="w-3 h-3 md:w-4 md:h-4" />
                  통합 검색&SOV 분석
                </div>
                <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight leading-tight">
                  See the Share.
                  <br />
                  <span className="gradient-text">Shape the Strategy</span>
                </h1>
                <p className="text-base md:text-lg text-muted-foreground max-w-lg">
                  네이버 4개 채널 통합 검색부터 브랜드 점유율(SOV) 분석까지
                  <br className="hidden sm:block" />
                  시장 키워드 점유율을 파악하고 전략을 설계하세요.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto group"
                    asChild
                    data-testid="button-get-started"
                  >
                    <a href="/auth">
                      무료로 시작하기
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </a>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto"
                    asChild
                    data-testid="button-learn-more"
                  >
                    <a href="#features">자세히 알아보기</a>
                  </Button>
                </div>
                <div className="flex items-center gap-4 md:gap-6 text-xs md:text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-chart-2" />
                    무료 플랜 제공
                  </div>
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-chart-2" />
                    API 키 암호화 저장
                  </div>
                </div>
              </div>

              <div className="relative hidden md:block animate-fade-in-up-delay-2">
                <div className="aspect-square max-w-lg mx-auto bg-gradient-to-br from-primary/20 via-chart-2/20 to-chart-5/20 rounded-3xl p-6 lg:p-8 flex items-center justify-center">
                  <div className="w-full space-y-3 lg:space-y-4">
                    <Card className="hover-lift glass-card">
                      <CardContent className="p-3 lg:p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg bg-chart-2/20 flex items-center justify-center">
                            <Search className="w-4 h-4 lg:w-5 lg:h-5 text-chart-2" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">블로그</div>
                            <div className="text-xs text-muted-foreground">
                              1,234건 검색됨
                            </div>
                          </div>
                          <div className="text-sm font-bold text-chart-2">
                            #3
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="hover-lift glass-card border-primary/30">
                      <CardContent className="p-3 lg:p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                            <PieChart className="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">SOV 분석</div>
                            <div className="text-xs text-muted-foreground">
                              브랜드A 점유율
                            </div>
                          </div>
                          <div className="text-lg font-bold text-primary">
                            42.5%
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="hover-lift glass-card">
                      <CardContent className="p-3 lg:p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg bg-chart-5/20 flex items-center justify-center">
                            <Globe className="w-4 h-4 lg:w-5 lg:h-5 text-chart-5" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">뉴스</div>
                            <div className="text-xs text-muted-foreground">
                              567건 검색됨
                            </div>
                          </div>
                          <div className="text-sm font-bold text-chart-5">
                            #1
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section - 4 Cards */}
        <section
          id="features"
          className="py-12 md:py-20 bg-card/50 scroll-mt-16"
        >
          <div className="container mx-auto px-4">
            <div className="text-center mb-8 md:mb-12 animate-fade-in">
              <h2 className="text-2xl md:text-3xl font-bold mb-3 md:mb-4">
                주요 기능
              </h2>
              <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
                네이버 검색 마케팅에 필요한 모든 기능을 한 곳에서 사용하세요.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <Card className="hover-lift animate-fade-in-up-delay-1">
                <CardContent className="p-5 md:p-6 text-center">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3 md:mb-4">
                    <Search className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                  </div>
                  <h3 className="text-base md:text-lg font-semibold mb-2">
                    4채널 통합 검색
                  </h3>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    블로그, 카페, 지식iN, 뉴스
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    검색 결과를 한 번에 확인
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-lift animate-fade-in-up-delay-2">
                <CardContent className="p-5 md:p-6 text-center">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-chart-2/10 flex items-center justify-center mx-auto mb-3 md:mb-4">
                    <Globe className="w-6 h-6 md:w-7 md:h-7 text-chart-2" />
                  </div>
                  <h3 className="text-base md:text-lg font-semibold mb-2">
                    스마트블록 크롤링
                  </h3>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    플레이스, 뉴스, VIEW 등
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    실시간 노출 현황 수집
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-lift animate-fade-in-up-delay-3">
                <CardContent className="p-5 md:p-6 text-center">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-chart-5/10 flex items-center justify-center mx-auto mb-3 md:mb-4">
                    <PieChart className="w-6 h-6 md:w-7 md:h-7 text-chart-5" />
                  </div>
                  <h3 className="text-base md:text-lg font-semibold mb-2">
                    SOV 점유율 분석
                  </h3>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    시장 키워드에서
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    브랜드별 노출 점유율 측정
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-lift animate-fade-in-up-delay-4">
                <CardContent className="p-5 md:p-6 text-center">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-3 md:mb-4">
                    <BarChart3 className="w-6 h-6 md:w-7 md:h-7 text-destructive" />
                  </div>
                  <h3 className="text-base md:text-lg font-semibold mb-2">
                    플레이스 리뷰 분석
                  </h3>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    네이버 플레이스 리뷰를
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    AI가 감정·키워드 분석
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* 3-Step How It Works Section */}
        <section id="how-it-works" className="py-12 md:py-20 scroll-mt-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8 md:mb-12 animate-fade-in">
              <h2 className="text-2xl md:text-3xl font-bold mb-3 md:mb-4">
                3단계로 시작하세요
              </h2>
              <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
                복잡한 설정 없이 간단하게 검색 모니터링을 시작할 수 있습니다.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-4xl mx-auto">
              <div className="relative text-center animate-fade-in-up-delay-1">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Key className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                </div>
                <div className="absolute top-7 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/30 to-transparent hidden md:block" />
                <div className="text-xs font-bold text-primary mb-2">
                  STEP 1
                </div>
                <h3 className="text-base md:text-lg font-semibold mb-2">
                  API 키 등록
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  네이버 개발자 센터에서
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  발급받은 API 키를 등록하세요
                </p>
              </div>
              <div className="relative text-center animate-fade-in-up-delay-2">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-chart-2/10 flex items-center justify-center mx-auto mb-4">
                  <Search className="w-6 h-6 md:w-7 md:h-7 text-chart-2" />
                </div>
                <div className="absolute top-7 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-chart-2/30 to-transparent hidden md:block" />
                <div className="text-xs font-bold text-chart-2 mb-2">
                  STEP 2
                </div>
                <h3 className="text-base md:text-lg font-semibold mb-2">
                  검색 & 분석
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  키워드를 입력하면 4채널 검색과
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  스마트블록 크롤링이 자동 실행됩니다
                </p>
              </div>
              <div className="relative text-center animate-fade-in-up-delay-3">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-chart-5/10 flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-6 h-6 md:w-7 md:h-7 text-chart-5" />
                </div>
                <div className="text-xs font-bold text-chart-5 mb-2">
                  STEP 3
                </div>
                <h3 className="text-base md:text-lg font-semibold mb-2">
                  결과 확인
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  통합 검색 결과와 SOV 점유율을
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  한눈에 확인하세요
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Trust & FAQ Section */}
        <section id="faq" className="py-12 md:py-20 bg-card/50 scroll-mt-16">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
              {/* Trust Elements */}
              <div className="animate-fade-in">
                <h2 className="text-2xl md:text-3xl font-bold mb-6">
                  안심하고 사용하세요
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 rounded-lg bg-background border">
                    <div className="w-10 h-10 rounded-lg bg-chart-2/10 flex items-center justify-center shrink-0">
                      <Lock className="w-5 h-5 text-chart-2" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">AES-256 암호화</h4>
                      <p className="text-sm text-muted-foreground">
                        API 키는 군사급 암호화 방식으로 안전하게 저장됩니다
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-lg bg-background border">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">이메일 인증</h4>
                      <p className="text-sm text-muted-foreground">
                        SendGrid 기반 이메일 인증으로 계정 보안을 강화합니다
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-lg bg-background border">
                    <div className="w-10 h-10 rounded-lg bg-chart-5/10 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-chart-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">실시간 데이터</h4>
                      <p className="text-sm text-muted-foreground">
                        검색 시점의 실제 네이버 검색 결과를 수집합니다
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* FAQ */}
              <div className="animate-fade-in-up-delay-2">
                <h2 className="text-2xl md:text-3xl font-bold mb-6">
                  자주 묻는 질문
                </h2>
                <div className="space-y-3">
                  {faqs.map((faq, index) => (
                    <Collapsible
                      key={index}
                      open={openFaq === index}
                      onOpenChange={(open) => setOpenFaq(open ? index : null)}
                    >
                      <Card className="overflow-hidden">
                        <CollapsibleTrigger className="w-full">
                          <CardContent className="p-4 flex items-center justify-between text-left">
                            <span className="font-medium text-sm md:text-base">
                              {faq.question}
                            </span>
                            <ChevronDown
                              className={`w-4 h-4 text-muted-foreground transition-transform ${openFaq === index ? "rotate-180" : ""}`}
                            />
                          </CardContent>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-4 pb-4 text-sm text-muted-foreground">
                            {faq.answer}
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-12 md:py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center animate-fade-in">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                지금 바로 시작하세요
              </h2>
              <p className="text-sm md:text-base text-muted-foreground mb-6 md:mb-8">
                무료로 가입하고 네이버 검색 모니터링을 시작하세요.
                <br className="hidden sm:block" />
                카드 등록 없이 바로 사용할 수 있습니다.
              </p>
              <Button size="lg" className="group" asChild>
                <a href="/auth">
                  무료로 시작하기
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </a>
              </Button>
              <div className="flex items-center justify-center gap-6 mt-6 text-xs md:text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-chart-2" />
                  무료 플랜 제공
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-chart-2" />
                  카드 등록 불필요
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-chart-2" />
                  즉시 사용 가능
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-6 md:py-8 border-t">
        <div className="container mx-auto px-4 text-center text-xs md:text-sm text-muted-foreground">
          © 2026 SearchBrand. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
