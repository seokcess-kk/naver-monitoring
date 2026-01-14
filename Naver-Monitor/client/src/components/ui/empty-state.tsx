import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { 
  SearchX, 
  AlertCircle, 
  Settings, 
  RefreshCw,
  LucideIcon
} from "lucide-react";

type EmptyStateVariant = "no-results" | "error" | "not-configured" | "custom";

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  icon?: LucideIcon;
  title: string;
  description?: string;
  suggestions?: string[];
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
}

const variantConfig: Record<EmptyStateVariant, { icon: LucideIcon; iconClass: string }> = {
  "no-results": {
    icon: SearchX,
    iconClass: "text-muted-foreground",
  },
  "error": {
    icon: AlertCircle,
    iconClass: "text-destructive",
  },
  "not-configured": {
    icon: Settings,
    iconClass: "text-amber-500",
  },
  "custom": {
    icon: RefreshCw,
    iconClass: "text-muted-foreground",
  },
};

export function EmptyState({
  variant = "no-results",
  icon: CustomIcon,
  title,
  description,
  suggestions,
  action,
  secondaryAction,
  className = "",
}: EmptyStateProps) {
  const config = variantConfig[variant];
  const Icon = CustomIcon || config.icon;

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      <div className={`w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4`}>
        <Icon className={`w-6 h-6 ${config.iconClass}`} />
      </div>
      
      <h3 className="text-base font-semibold mb-2">{title}</h3>
      
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          {description}
        </p>
      )}
      
      {suggestions && suggestions.length > 0 && (
        <ul className="text-sm text-muted-foreground mb-4 space-y-1">
          {suggestions.map((suggestion, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
              {suggestion}
            </li>
          ))}
        </ul>
      )}
      
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-2">
          {action && (
            action.href ? (
              <Button size="sm" asChild>
                <a href={action.href}>{action.label}</a>
              </Button>
            ) : (
              <Button size="sm" onClick={action.onClick}>
                {action.label}
              </Button>
            )
          )}
          {secondaryAction && (
            secondaryAction.href ? (
              <Button size="sm" variant="outline" asChild>
                <a href={secondaryAction.href}>{secondaryAction.label}</a>
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
}
