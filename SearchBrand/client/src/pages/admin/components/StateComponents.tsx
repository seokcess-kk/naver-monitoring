import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Loader2, 
  FileX, 
  AlertCircle, 
  RefreshCw, 
  FilterX,
  SearchX,
  Database,
  type LucideIcon 
} from "lucide-react";

interface LoadingStateProps {
  rows?: number;
  columns?: number;
  message?: string;
}

export function LoadingState({ rows = 5, columns = 5, message }: LoadingStateProps) {
  return (
    <Card className="p-6">
      {message && (
        <div className="flex items-center justify-center gap-2 mb-4 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">{message}</span>
        </div>
      )}
      <div className="space-y-3">
        {[...Array(rows)].map((_, rowIdx) => (
          <div key={rowIdx} className="flex gap-4">
            {[...Array(columns)].map((_, colIdx) => (
              <Skeleton 
                key={colIdx} 
                className="h-4 flex-1" 
                style={{ maxWidth: colIdx === 0 ? "120px" : undefined }}
              />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

interface TableLoadingProps {
  rows?: number;
  columnWidths?: string[];
}

export function TableLoading({ rows = 5, columnWidths = ["w-28", "w-32", "w-20", "w-40", "w-32"] }: TableLoadingProps) {
  return (
    <>
      {[...Array(rows)].map((_, i) => (
        <tr key={i} className="border-b">
          {columnWidths.map((width, j) => (
            <td key={j} className="p-4">
              <Skeleton className={`h-4 ${width}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

type EmptyStateType = "no-data" | "no-results" | "no-filter-results";

interface EmptyStateProps {
  type?: EmptyStateType;
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const emptyStateDefaults: Record<EmptyStateType, { icon: LucideIcon; title: string; description: string }> = {
  "no-data": {
    icon: Database,
    title: "데이터가 없습니다",
    description: "아직 기록된 데이터가 없습니다.",
  },
  "no-results": {
    icon: SearchX,
    title: "검색 결과가 없습니다",
    description: "검색 조건에 맞는 결과를 찾을 수 없습니다.",
  },
  "no-filter-results": {
    icon: FilterX,
    title: "필터 결과가 없습니다",
    description: "현재 필터 조건에 맞는 항목이 없습니다. 필터를 변경해 보세요.",
  },
};

export function EmptyState({ 
  type = "no-data", 
  icon, 
  title, 
  description, 
  action 
}: EmptyStateProps) {
  const defaults = emptyStateDefaults[type];
  const Icon = icon || defaults.icon;
  
  return (
    <Card className="p-8">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="rounded-full bg-muted p-3 mb-4">
          <Icon className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-1">{title || defaults.title}</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
          {description || defaults.description}
        </p>
        {action && (
          <Button variant="outline" size="sm" onClick={action.onClick}>
            <FilterX className="w-4 h-4 mr-1.5" />
            {action.label}
          </Button>
        )}
      </div>
    </Card>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({ 
  title = "오류가 발생했습니다", 
  description = "데이터를 불러오는 중 문제가 발생했습니다. 다시 시도해 주세요.", 
  onRetry 
}: ErrorStateProps) {
  return (
    <Card className="p-8 border-destructive/30 bg-destructive/5">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="rounded-full bg-destructive/10 p-3 mb-4">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <h3 className="text-lg font-medium mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">{description}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            다시 시도
          </Button>
        )}
      </div>
    </Card>
  );
}

interface DataStateWrapperProps {
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  hasFilters?: boolean;
  onRetry?: () => void;
  onClearFilters?: () => void;
  loadingRows?: number;
  loadingColumns?: number;
  children: ReactNode;
}

export function DataStateWrapper({
  isLoading,
  isError,
  isEmpty,
  hasFilters,
  onRetry,
  onClearFilters,
  loadingRows = 5,
  loadingColumns = 5,
  children,
}: DataStateWrapperProps) {
  if (isLoading) {
    return <LoadingState rows={loadingRows} columns={loadingColumns} />;
  }

  if (isError) {
    return <ErrorState onRetry={onRetry} />;
  }

  if (isEmpty) {
    return (
      <EmptyState
        type={hasFilters ? "no-filter-results" : "no-data"}
        action={hasFilters && onClearFilters ? {
          label: "필터 초기화",
          onClick: onClearFilters,
        } : undefined}
      />
    );
  }

  return <>{children}</>;
}
