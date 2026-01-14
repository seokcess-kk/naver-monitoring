import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, BarChart3, Shield, Zap, Layers, Globe, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b glass-card">
        <div className="container mx-auto px-4 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-9 md:h-9 bg-primary rounded-lg flex items-center justify-center">
              <Layers className="w-4 h-4 md:w-5 md:h-5 text-primary-foreground" />
            </div>
            <span className="text-base md:text-lg font-bold">통합 모니터링</span>
          </div>
          <Button asChild size="sm" data-testid="button-login">
            <a href="/auth">로그인</a>
          </Button>
        </div>
      </header>

      <main>
        <section className="py-12 md:py-20 lg:py-32 overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div className="space-y-6 md:space-y-8 animate-fade-in-up">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs md:text-sm font-medium">
                  <Zap className="w-3 h-3 md:w-4 md:h-4" />
                  실시간 모니터링
                </div>
                <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight leading-tight">
                  네이버 검색 결과를
                  <br />
                  <span className="gradient-text">한눈에</span> 파악하세요
                </h1>
                <p className="text-base md:text-lg text-muted-foreground max-w-lg">
                  스마트블록, 플레이스, 블로그, 카페, 지식iN, 뉴스까지.
                  4개 채널의 검색 순위를 실시간으로 모니터링하고 분석하세요.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                  <Button size="lg" className="w-full sm:w-auto group" asChild data-testid="button-get-started">
                    <a href="/auth">
                      무료로 시작하기
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </a>
                  </Button>
                  <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild data-testid="button-learn-more">
                    <a href="#features">자세히 알아보기</a>
                  </Button>
                </div>
                <div className="flex items-center gap-4 md:gap-6 text-xs md:text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-chart-2" />
                    무료 플랜 제공
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-chart-2" />
                    카드 등록 불필요
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
                            <div className="text-xs text-muted-foreground">1,234건 검색됨</div>
                          </div>
                          <div className="text-sm font-bold text-chart-2">#3</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="hover-lift glass-card">
                      <CardContent className="p-3 lg:p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
                            <BarChart3 className="w-4 h-4 lg:w-5 lg:h-5 text-destructive" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">카페</div>
                            <div className="text-xs text-muted-foreground">892건 검색됨</div>
                          </div>
                          <div className="text-sm font-bold text-destructive">#7</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="hover-lift glass-card">
                      <CardContent className="p-3 lg:p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                            <Globe className="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">뉴스</div>
                            <div className="text-xs text-muted-foreground">567건 검색됨</div>
                          </div>
                          <div className="text-sm font-bold text-primary">#1</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-12 md:py-20 bg-card/50 scroll-mt-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8 md:mb-12 animate-fade-in">
              <h2 className="text-2xl md:text-3xl font-bold mb-3 md:mb-4">주요 기능</h2>
              <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
                네이버 검색 마케팅에 필요한 모든 기능을 한 곳에서 사용하세요.
              </p>
            </div>
            <div className="mobile-horizontal-scroll md:grid md:grid-cols-3 md:gap-6">
              <Card className="hover-lift w-[280px] md:w-auto animate-fade-in-up-delay-1">
                <CardContent className="p-5 md:p-6 text-center">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3 md:mb-4">
                    <Search className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                  </div>
                  <h3 className="text-base md:text-lg font-semibold mb-2">4채널 통합 검색</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    블로그, 카페, 지식iN, 뉴스 4개 채널의 검색 결과를 한 번에 확인하세요.
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-lift w-[280px] md:w-auto animate-fade-in-up-delay-2">
                <CardContent className="p-5 md:p-6 text-center">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-chart-2/10 flex items-center justify-center mx-auto mb-3 md:mb-4">
                    <Layers className="w-6 h-6 md:w-7 md:h-7 text-chart-2" />
                  </div>
                  <h3 className="text-base md:text-lg font-semibold mb-2">스마트블록 분석</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    플레이스, 뉴스, VIEW 등 스마트블록 노출 현황을 실시간으로 크롤링합니다.
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-lift w-[280px] md:w-auto animate-fade-in-up-delay-3">
                <CardContent className="p-5 md:p-6 text-center">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-chart-5/10 flex items-center justify-center mx-auto mb-3 md:mb-4">
                    <BarChart3 className="w-6 h-6 md:w-7 md:h-7 text-chart-5" />
                  </div>
                  <h3 className="text-base md:text-lg font-semibold mb-2">순위 매칭</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    스마트블록과 API 검색 결과를 매칭하여 노출 현황을 한눈에 파악하세요.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-6 md:py-8 border-t">
        <div className="container mx-auto px-4 text-center text-xs md:text-sm text-muted-foreground">
          © 2024 네이버 통합 모니터링. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
