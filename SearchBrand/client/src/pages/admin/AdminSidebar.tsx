import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, Search, Star, X } from "lucide-react";
import { TAB_GROUPS, type TabConfig } from "./adminTabs";

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const FAVORITES_STORAGE_KEY = "admin-favorite-tabs";

function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favorites)));
  }, [favorites]);

  const toggleFavorite = (tabId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(tabId)) {
        next.delete(tabId);
      } else {
        next.add(tabId);
      }
      return next;
    });
  };

  return { favorites, toggleFavorite };
}

export function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(TAB_GROUPS.filter((g) => !g.collapsed).map((g) => g.id))
  );
  const [searchQuery, setSearchQuery] = useState("");
  const { favorites, toggleFavorite } = useFavorites();

  const allTabs = useMemo(() => TAB_GROUPS.flatMap((g) => g.tabs), []);
  const activeTabConfig = allTabs.find((t) => t.id === activeTab);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return TAB_GROUPS;
    
    const query = searchQuery.toLowerCase();
    return TAB_GROUPS.map((group) => ({
      ...group,
      tabs: group.tabs.filter((tab) => 
        tab.label.toLowerCase().includes(query) ||
        tab.id.toLowerCase().includes(query)
      ),
    })).filter((group) => group.tabs.length > 0);
  }, [searchQuery]);

  const favoriteTabs = useMemo(() => {
    return allTabs.filter((tab) => favorites.has(tab.id));
  }, [allTabs, favorites]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const renderTabItem = (tab: TabConfig, showFavorite: boolean = true) => {
    const Icon = tab.icon;
    const isFavorite = favorites.has(tab.id);
    
    return (
      <div key={tab.id} className="group relative flex items-center">
        <TabsTrigger
          value={tab.id}
          className={cn(
            "flex items-center justify-start gap-2 w-full px-3 py-2 text-sm rounded-md pr-8",
            "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none",
            "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-accent data-[state=inactive]:hover:text-accent-foreground"
          )}
        >
          <Icon className="w-4 h-4" />
          <span className="truncate">{tab.label}</span>
        </TabsTrigger>
        {showFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(tab.id);
            }}
            className={cn(
              "absolute right-1.5 p-1 rounded transition-opacity",
              isFavorite 
                ? "opacity-100 text-yellow-500 hover:text-yellow-600" 
                : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
            )}
            title={isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
          >
            <Star className={cn("w-3.5 h-3.5", isFavorite && "fill-current")} />
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="lg:hidden w-full mb-4 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="메뉴 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <Select value={activeTab} onValueChange={onTabChange}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {activeTabConfig && (
                <div className="flex items-center gap-2">
                  <activeTabConfig.icon className="w-4 h-4" />
                  <span>{activeTabConfig.label}</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {favoriteTabs.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                  즐겨찾기
                </SelectLabel>
                {favoriteTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <SelectItem key={`fav-${tab.id}`} value={tab.id}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            )}
            {filteredGroups.map((group) => (
              <SelectGroup key={group.id}>
                <SelectLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </SelectLabel>
                {group.tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <SelectItem key={tab.id} value={tab.id}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <TabsList className="sr-only">
          {allTabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <aside className="hidden lg:block w-56 shrink-0 border-r bg-card/50">
        <nav className="sticky top-0 p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="메뉴 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-8 h-9 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {!searchQuery && favoriteTabs.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                <span>즐겨찾기</span>
              </div>
              <TabsList className="flex flex-col h-auto bg-transparent mt-1 space-y-0.5 p-0">
                {favoriteTabs.map((tab) => renderTabItem(tab, false))}
              </TabsList>
            </div>
          )}

          {filteredGroups.map((group) => (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
              >
                <span>{group.label}</span>
                {expandedGroups.has(group.id) ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
              {(expandedGroups.has(group.id) || searchQuery) && (
                <TabsList className="flex flex-col h-auto bg-transparent mt-1 space-y-0.5 p-0">
                  {group.tabs.map((tab) => renderTabItem(tab))}
                </TabsList>
              )}
            </div>
          ))}

          {searchQuery && filteredGroups.length === 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              검색 결과가 없습니다
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}
