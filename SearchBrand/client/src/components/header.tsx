import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Settings, Shield, Search, MessageSquare, Menu } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { href: "/", label: "통합검색", icon: Search },
  { href: "/place-review", label: "플레이스 리뷰", icon: MessageSquare },
];

export function Header() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] || "";
    const last = lastName?.[0] || "";
    return (first + last).toUpperCase() || "U";
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4 max-w-7xl">
        <div className="flex items-center gap-6">
          <Link href="/">
            <div className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
              <svg className="w-10 h-10" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="224" cy="224" r="120" stroke="#1D4ED8" strokeWidth="24" />
                <circle cx="224" cy="224" r="72" stroke="#22D3EE" strokeWidth="16" />
                <path d="M318 318L408 408" stroke="#1D4ED8" strokeWidth="28" strokeLinecap="round" />
                <path d="M344 92C396 122 432 176 432 240" stroke="#22D3EE" strokeWidth="16" strokeLinecap="round" />
              </svg>
              <div className="flex flex-col items-end relative" style={{ top: '3px' }}>
                <span className="text-xl font-bold tracking-tight leading-none" style={{ fontFamily: "'Inter', sans-serif", color: '#1D4ED8', letterSpacing: '-0.8px' }}>
                  Search<span style={{ color: '#22D3EE' }}>Brand</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium leading-none mt-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>
                  powered by Glitzy
                </span>
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "gap-2 font-medium transition-all px-4",
                      isActive 
                        ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <div className="flex flex-col gap-4 mt-6">
                <div className="flex items-center px-2 mb-4">
                  <svg className="w-9 h-9" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="224" cy="224" r="120" stroke="#1D4ED8" strokeWidth="24" />
                    <circle cx="224" cy="224" r="72" stroke="#22D3EE" strokeWidth="16" />
                    <path d="M318 318L408 408" stroke="#1D4ED8" strokeWidth="28" strokeLinecap="round" />
                    <path d="M344 92C396 122 432 176 432 240" stroke="#22D3EE" strokeWidth="16" strokeLinecap="round" />
                  </svg>
                  <div className="flex flex-col items-end relative" style={{ top: '2px' }}>
                    <span className="text-lg font-bold tracking-tight leading-none" style={{ fontFamily: "'Inter', sans-serif", color: '#1D4ED8', letterSpacing: '-0.8px' }}>
                      Search<span style={{ color: '#22D3EE' }}>Brand</span>
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium leading-none mt-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>
                      powered by Glitzy
                    </span>
                  </div>
                </div>
                <nav className="flex flex-col gap-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                    return (
                      <Link key={item.href} href={item.href}>
                        <Button
                          variant={isActive ? "secondary" : "ghost"}
                          className={cn(
                            "w-full justify-start gap-3 font-medium",
                            isActive && "bg-primary/10 text-primary"
                          )}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Icon className="w-4 h-4" />
                          {item.label}
                        </Button>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-9 w-9 rounded-full ring-2 ring-border/50 hover:ring-primary/30 transition-all"
                data-testid="button-user-menu"
                aria-label="사용자 메뉴"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage
                    src={user?.profileImageUrl || undefined}
                    alt={user?.firstName || "User"}
                  />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-violet-600 text-primary-foreground text-sm font-semibold">
                    {getInitials(user?.firstName, user?.lastName)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <div className="flex items-center gap-3 p-3">
                <Avatar className="h-11 w-11">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-violet-600 text-primary-foreground font-semibold">
                    {getInitials(user?.firstName, user?.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold truncate">
                    {user?.firstName} {user?.lastName}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <Link href="/profile">
                <DropdownMenuItem data-testid="menu-item-profile">
                  <User className="mr-2 h-4 w-4" />
                  프로필
                </DropdownMenuItem>
              </Link>
              <Link href="/profile">
                <DropdownMenuItem data-testid="menu-item-settings">
                  <Settings className="mr-2 h-4 w-4" />
                  설정
                </DropdownMenuItem>
              </Link>
              {(user?.role === "admin" || user?.role === "superadmin") && (
                <Link href="/admin">
                  <DropdownMenuItem data-testid="menu-item-admin">
                    <Shield className="mr-2 h-4 w-4" />
                    관리자
                  </DropdownMenuItem>
                </Link>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logout()}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                data-testid="button-logout"
              >
                <LogOut className="mr-2 h-4 w-4" />
                로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
