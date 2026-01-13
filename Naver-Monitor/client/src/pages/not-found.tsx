import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
            <span className="text-4xl font-bold text-muted-foreground">404</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">페이지를 찾을 수 없습니다</h1>
          <p className="text-muted-foreground mb-6">
            요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" onClick={() => window.history.back()} data-testid="button-go-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              뒤로 가기
            </Button>
            <Button asChild data-testid="button-go-home">
              <a href="/">
                <Home className="mr-2 h-4 w-4" />
                홈으로 이동
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
