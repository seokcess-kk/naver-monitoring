import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SearchPanelProps {
  onSearch: (keyword: string, sort: "sim" | "date") => void;
  isSearching: boolean;
  hasApiKey: boolean;
}

export function SearchPanel({
  onSearch,
  isSearching,
  hasApiKey,
}: SearchPanelProps) {
  const [keyword, setKeyword] = useState("");
  const [sortType, setSortType] = useState<"sim" | "date">("sim");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) {
      toast({
        title: "검색어 입력",
        description: "모니터링할 키워드를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }
    if (!hasApiKey) {
      toast({
        title: "API 키 필요",
        description: "먼저 네이버 API 키를 등록해주세요.",
        variant: "destructive",
      });
      return;
    }
    onSearch(keyword, sortType);
  };

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-primary via-violet-500 to-sky-500" />
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">통합검색</h2>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col md:flex-row gap-4 items-end"
        >
          <div className="flex-1 w-full">
            <label className="block text-sm font-semibold mb-2 text-foreground/80">
              모니터링 키워드
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/60" />
              <Input
                type="search"
                placeholder="예: 강남 맛집, 임플란트 가격, 다이어트한의원"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-12 h-12 text-base bg-muted/30 border-border/50 focus:bg-background transition-colors"
                data-testid="input-search-keyword"
              />
            </div>
          </div>

          <div className="w-full md:w-44">
            <label className="block text-sm font-semibold mb-2 text-foreground/80">
              API 정렬 기준
            </label>
            <Select
              value={sortType}
              onValueChange={(v) => setSortType(v as "sim" | "date")}
            >
              <SelectTrigger
                className="h-12 bg-muted/30 border-border/50"
                data-testid="select-sort-type"
              >
                <SelectValue placeholder="정렬 기준" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">정확도순</SelectItem>
                <SelectItem value="date">최신순</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={isSearching || !hasApiKey}
            className="w-full md:w-auto h-12 px-8 font-semibold shadow-sm"
            data-testid="button-search"
          >
            {isSearching ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                검색 중...
              </>
            ) : (
              <>
                <Search className="mr-2 h-5 w-5" />
                검색
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
