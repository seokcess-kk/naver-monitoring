import { ReactNode, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Filter, X, Download, type LucideIcon } from "lucide-react";

interface SummaryItem {
  label: string;
  value: string | number;
  variant?: "default" | "success" | "warning" | "destructive";
}

interface AppliedFilter {
  label: string;
  value: string;
}

interface TabPageLayoutProps {
  children: ReactNode;
  summary?: SummaryItem[];
  actions?: ReactNode;
  filterContent?: ReactNode;
  appliedFilters?: AppliedFilter[];
  onClearFilters?: () => void;
  isLoading?: boolean;
}

export function TabPageLayout({
  children,
  summary,
  actions,
  filterContent,
  appliedFilters = [],
  onClearFilters,
  isLoading,
}: TabPageLayoutProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const hasAppliedFilters = appliedFilters.length > 0;

  return (
    <div className="space-y-4">
      {(summary || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {summary && summary.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {summary.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{item.label}:</span>
                  <span className={`font-semibold ${
                    item.variant === "success" ? "text-green-600" :
                    item.variant === "warning" ? "text-yellow-600" :
                    item.variant === "destructive" ? "text-red-600" :
                    "text-foreground"
                  }`}>
                    {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
                  </span>
                </div>
              ))}
            </div>
          )}
          {actions && (
            <div className="flex items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>
      )}

      {filterContent && (
        <Collapsible open={filterOpen} onOpenChange={setFilterOpen}>
          <div className="flex items-center gap-2 flex-wrap">
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                필터
                {filterOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            </CollapsibleTrigger>

            {hasAppliedFilters && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {appliedFilters.map((f, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {f.label}: {f.value}
                    </Badge>
                  ))}
                </div>
                {onClearFilters && (
                  <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-7 px-2 text-xs">
                    <X className="w-3 h-3 mr-1" />
                    초기화
                  </Button>
                )}
              </>
            )}
          </div>

          <CollapsibleContent className="mt-3">
            <Card className="p-4 bg-muted/30">
              {filterContent}
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}

      {children}
    </div>
  );
}

interface FilterRowProps {
  children: ReactNode;
  onApply: () => void;
  onReset: () => void;
}

export function FilterRow({ children, onApply, onReset }: FilterRowProps) {
  return (
    <div className="flex flex-wrap gap-4 items-end">
      {children}
      <div className="flex gap-2 ml-auto">
        <Button variant="default" size="sm" onClick={onApply}>
          적용
        </Button>
        <Button variant="ghost" size="sm" onClick={onReset}>
          초기화
        </Button>
      </div>
    </div>
  );
}

interface FilterFieldProps {
  label: string;
  children: ReactNode;
}

export function FilterField({ label, children }: FilterFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground font-medium">{label}</label>
      {children}
    </div>
  );
}

interface ActionButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost";
  disabled?: boolean;
}

export function ActionButton({ icon: Icon, label, onClick, variant = "outline", disabled }: ActionButtonProps) {
  return (
    <Button variant={variant} size="sm" onClick={onClick} disabled={disabled} className="h-8">
      <Icon className="w-4 h-4 mr-1.5" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

export function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <ActionButton icon={Download} label="CSV 내보내기" onClick={onClick} disabled={disabled} />
  );
}
