"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Bot,
  ListTodo,
  DollarSign,
  TrendingUp,
  Calculator,
  Settings,
  LogOut,
  User,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCurrency } from "@/hooks/use-currency";

type DisplayCurrency = "usd" | "brl";

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Bots", href: "/bots", icon: Bot },
  { title: "Tarefas", href: "/tasks", icon: ListTodo },
  { title: "Vendas", href: "/sales", icon: DollarSign },
  { title: "Precos", href: "/prices", icon: TrendingUp },
  { title: "Simulacoes", href: "/simulations", icon: Calculator },
  { title: "Configuracoes", href: "/settings", icon: Settings },
];

interface SidebarContentProps {
  pathname: string;
  userName: string;
  userRole: string;
  displayCurrency: string;
  exchangeRate: number;
  onSetDisplayCurrency: (c: DisplayCurrency) => void;
  onClose?: () => void;
}

function SidebarContent({
  pathname,
  userName,
  userRole,
  displayCurrency,
  exchangeRate,
  onSetDisplayCurrency,
  onClose,
}: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-6">
        <Link
          href="/dashboard"
          className="text-xl font-bold text-sidebar-foreground"
          onClick={onClose}
        >
          PoE HUB
        </Link>
      </div>
      <Separator />
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-2 space-y-1">
        <div className="flex items-center justify-between px-3">
          <span className="text-[10px] text-muted-foreground/60">USD/BRL</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            R$ {exchangeRate.toFixed(2)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between px-3 text-muted-foreground hover:text-sidebar-foreground"
          onClick={() =>
            onSetDisplayCurrency(
              (displayCurrency === "usd" ? "brl" : "usd") as DisplayCurrency
            )
          }
        >
          <span className="text-xs font-medium">
            {displayCurrency === "usd" ? "$ USD" : "R$ BRL"}
          </span>
          <span className="text-[10px] text-muted-foreground/60">
            {displayCurrency === "usd" ? "→ BRL" : "→ USD"}
          </span>
        </Button>
      </div>
      <Separator />
      <div className="px-3 py-3">
        <div className="flex items-center gap-3 rounded-md px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-sidebar-foreground">
              {userName}
            </p>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {userRole === "admin" ? "Admin" : "Operador"}
            </Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground mt-1"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const userName = session?.user?.name ?? "Usuario";
  const userRole = (session?.user as { role?: string })?.role ?? "operator";
  const { displayCurrency, setDisplayCurrency, exchangeRate } = useCurrency();

  const sharedProps: SidebarContentProps = {
    pathname,
    userName,
    userRole,
    displayCurrency,
    exchangeRate,
    onSetDisplayCurrency: setDisplayCurrency,
  };

  return (
    <>
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:flex h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar-background">
        <SidebarContent {...sharedProps} />
      </aside>

      {/* Mobile hamburger button + Sheet drawer */}
      <div className="md:hidden fixed top-0 left-0 z-40 flex h-14 w-full items-center border-b border-border bg-background px-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <span className="ml-3 text-lg font-bold">PoE HUB</span>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar-background">
            <SidebarContent
              {...sharedProps}
              onClose={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
