"use client";

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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Bots", href: "/bots", icon: Bot },
  { title: "Tarefas", href: "/tasks", icon: ListTodo },
  { title: "Vendas", href: "/sales", icon: DollarSign },
  { title: "Precos", href: "/prices", icon: TrendingUp },
  { title: "Simulacoes", href: "/simulations", icon: Calculator },
  { title: "Configuracoes", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const userName = session?.user?.name ?? "Usuario";
  const userRole = (session?.user as { role?: string })?.role ?? "operator";

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-sidebar-background">
      <div className="flex h-14 items-center px-6">
        <Link href="/dashboard" className="text-xl font-bold text-sidebar-foreground">
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
    </aside>
  );
}
