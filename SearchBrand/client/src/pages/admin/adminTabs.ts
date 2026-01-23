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
  type LucideIcon,
} from "lucide-react";

export interface TabConfig {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface TabGroup {
  id: string;
  label: string;
  tabs: TabConfig[];
}

export const TAB_GROUPS: TabGroup[] = [
  {
    id: "management",
    label: "운영/관리",
    tabs: [
      { id: "users", label: "사용자", icon: Users },
      { id: "solutions", label: "솔루션", icon: Package },
      { id: "apikeys", label: "API 키", icon: Key },
    ],
  },
  {
    id: "analytics",
    label: "분석",
    tabs: [
      { id: "sov", label: "SOV 분석", icon: Activity },
      { id: "logs", label: "검색 로그", icon: Search },
      { id: "insights", label: "인사이트", icon: BarChart3 },
      { id: "api-usage", label: "API 사용량", icon: Zap },
    ],
  },
  {
    id: "system",
    label: "시스템",
    tabs: [
      { id: "system", label: "시스템 상태", icon: Server },
      { id: "data-quality", label: "데이터 품질", icon: Database },
      { id: "audit", label: "감사 로그", icon: FileText },
    ],
  },
];

export const DEFAULT_TAB = "users";
