import { useState } from "react";
import { cn } from "@/lib/utils";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TAB_GROUPS } from "./adminTabs";

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(TAB_GROUPS.filter((g) => !g.collapsed).map((g) => g.id))
  );

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

  const allTabs = TAB_GROUPS.flatMap((g) => g.tabs);
  const activeTabConfig = allTabs.find((t) => t.id === activeTab);

  return (
    <>
      <div className="lg:hidden w-full mb-4">
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
            {TAB_GROUPS.map((group) => (
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
          {TAB_GROUPS.map((group) => (
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
              {expandedGroups.has(group.id) && (
                <TabsList className="flex flex-col h-auto bg-transparent mt-1 space-y-0.5 p-0">
                  {group.tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className={cn(
                          "flex items-center justify-start gap-2 w-full px-3 py-2 text-sm rounded-md",
                          "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none",
                          "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-accent data-[state=inactive]:hover:text-accent-foreground"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              )}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
