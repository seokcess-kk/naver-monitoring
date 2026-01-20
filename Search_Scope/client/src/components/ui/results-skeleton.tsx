import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function StatCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className={`grid gap-4 md:grid-cols-${count}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <Skeleton className="h-8 w-12 mb-1" />
            <Skeleton className="h-3 w-8" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ReviewCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4 mb-3" />
        <div className="flex flex-wrap gap-1">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ReviewListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <ReviewCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className={`w-full ${height}`} />
      </CardContent>
    </Card>
  );
}

export function InsightCardSkeleton() {
  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-background">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-4 p-3 border-b">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-3">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function AspectBarsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-8" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
