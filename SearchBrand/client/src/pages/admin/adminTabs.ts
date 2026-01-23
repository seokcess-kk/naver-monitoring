import { 
  Users, 
  Activity, 
  Search, 
  FileText, 
  Key, 
  Package, 
  BarChart3, 
  Server, 
  Zap, 
  Database,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

export interface TabConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  priority: number;
  isDefault?: boolean;
}

export interface TabGroup {
  id: string;
  label: string;
  priority: number;
  collapsed?: boolean;
  tabs: TabConfig[];
}

export const TAB_GROUPS: TabGroup[] = [
  {
    id: "management",
    label: "운영/관리",
    priority: 1,
    tabs: [
      { id: "users", label: "사용자", icon: Users, priority: 1, isDefault: true },
      { id: "solutions", label: "솔루션", icon: Package, priority: 2 },
      { id: "apikeys", label: "API 키", icon: Key, priority: 3 },
    ],
  },
  {
    id: "analytics",
    label: "분석",
    priority: 2,
    tabs: [
      { id: "sov", label: "SOV 분석", icon: Activity, priority: 1 },
      { id: "logs", label: "검색 로그", icon: Search, priority: 2 },
      { id: "insights", label: "인사이트", icon: BarChart3, priority: 3 },
      { id: "api-usage", label: "API 사용량", icon: Zap, priority: 4 },
    ],
  },
  {
    id: "system",
    label: "시스템",
    priority: 3,
    tabs: [
      { id: "system", label: "시스템 상태", icon: Server, priority: 1 },
    ],
  },
  {
    id: "other",
    label: "더보기",
    priority: 4,
    collapsed: true,
    tabs: [
      { id: "data-quality", label: "데이터 품질", icon: Database, priority: 1 },
      { id: "audit", label: "감사 로그", icon: FileText, priority: 2 },
    ],
  },
].map(group => ({
  ...group,
  tabs: [...group.tabs].sort((a, b) => a.priority - b.priority),
})).sort((a, b) => a.priority - b.priority);

const allTabs = TAB_GROUPS.flatMap(g => g.tabs);
const defaultTab = allTabs.find(t => t.isDefault);
export const DEFAULT_TAB = defaultTab?.id ?? "users";
