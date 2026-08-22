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
  Repeat,
  Calculator,
  Settings,
  LogOut,
  User,
  Menu,
  BookOpen,
  PenTool,
  Search,
  BarChart3,
  FileText,
  Lightbulb,
  Wrench,
  ScrollText,
  Users,
  BookOpenCheck,
  ChevronDown,
  Monitor,
  Clock,
  BellRing,
  Activity,
  Newspaper,
  Database,
  BrainCircuit,
  Sword,
  type LucideIcon,
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

type NavItem = { title: string; href: string; icon: LucideIcon };

// NavGroup children can be flat NavItems or nested NavGroups (2-level max).
type NavGroup = { title: string; icon: LucideIcon; children: NavEntry[] };
type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
}

// Returns true if any descendant NavItem is active (recursive, for nested groups).
function hasActiveDescendant(entry: NavEntry, pathname: string): boolean {
  if (!isGroup(entry)) {
    return pathname === entry.href || pathname.startsWith(entry.href + "/");
  }
  return entry.children.some((child) => hasActiveDescendant(child, pathname));
}

// Session 01 IA rework: 5 top-level domains + Dashboard.
//   /workspace — content engine (briefing, write, critique)
//   /seo       — research/analysis/opportunities
//   /farm      — PoE ops (bots, prices, sales, simulations)
//   /admin     — config, observability, tasks
//   /hardware  — deals feed + builder (standalone, not tied to PoE cycle)
const navSections: { label: string; items: NavEntry[] }[] = [
  {
    label: "",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      {
        title: "Workspace",
        icon: PenTool,
        children: [
          // Blog subgroup — S08.h (replaces legacy /workspace/new single link)
          {
            title: "Blog",
            icon: Newspaper,
            children: [
              { title: "Lista", href: "/workspace/blog", icon: FileText },
              { title: "Novo post", href: "/workspace/blog/new", icon: Newspaper },
            ],
          },
          { title: "Guides", href: "/workspace/guides", icon: BookOpen },
          { title: "Builds", href: "/workspace/builds", icon: Sword },
          { title: "Ideas", href: "/workspace/ideas", icon: Lightbulb },
          { title: "Templates", href: "/workspace/templates", icon: FileText },
          { title: "Slang", href: "/workspace/slang", icon: BookOpenCheck },
        ],
      },
      {
        title: "SEO",
        icon: Search,
        children: [
          // /seo/research is the renamed legacy /seo page (god file, split in B4).
          // /seo/analysis and /seo/opportunities are B4 placeholders.
          { title: "Research", href: "/seo/research", icon: Search },
          { title: "Analysis", href: "/seo/analysis", icon: BarChart3 },
          { title: "Opportunities", href: "/seo/opportunities", icon: TrendingUp },
          // Session 32 Frontend B — operator-facing post recommendations.
          { title: "Recomendações", href: "/seo/posts-recommended", icon: Lightbulb },
          { title: "Reddit", href: "/seo/reddit", icon: ScrollText },
          { title: "YouTube", href: "/seo/youtube", icon: BarChart3 },
          { title: "KeyBERT", href: "/seo/keybert", icon: Search },
        ],
      },
      {
        title: "Farm",
        icon: Bot,
        children: [
          { title: "Bots", href: "/farm/bots", icon: Bot },
          { title: "Vendas", href: "/farm/sales", icon: DollarSign },
          { title: "Sinais (Cambio)", href: "/farm/signals", icon: TrendingUp },
          { title: "Exchange", href: "/farm/fills", icon: Repeat },
          { title: "CX Bot", href: "/farm/cx", icon: Activity },
          { title: "CX Stats", href: "/farm/cx/stats", icon: BarChart3 },
          { title: "CX Brain", href: "/cx/brain", icon: BrainCircuit },
          { title: "Precos", href: "/farm/prices", icon: TrendingUp },
          { title: "Profit", href: "/farm/profit", icon: Calculator },
          { title: "Venda de Bots", href: "/farm/bot-sales", icon: DollarSign },
          { title: "Simulacoes", href: "/farm/simulations", icon: Calculator },
          { title: "Faturamento Anual", href: "/farm/simulations/annual", icon: Calculator },
        ],
      },
      {
        title: "Hardware",
        icon: Monitor,
        children: [
          { title: "Deals", href: "/hardware", icon: Monitor },
          { title: "Recentes", href: "/hardware/recent", icon: Clock },
          { title: "Alertas", href: "/hardware/alerts", icon: BellRing },
          { title: "Builder & VMs", href: "/hardware/builder", icon: Wrench },
          { title: "Analytics", href: "/hardware/analytics", icon: BarChart3 },
        ],
      },
      {
        // Admin sub-grouped into 3 semantic clusters (S07.h):
        //   Operacoes — runtime observability + task tracking
        //   SEO Tools — GSC (admin-level, distinct from /seo workspace)
        //   Config    — all YAML / system configuration pages
        title: "Admin",
        icon: Settings,
        children: [
          {
            title: "Operacoes",
            icon: Activity,
            children: [
              // Session 23 — Operations + Observability fundidas em /admin/runtime
              // (tabs Saúde/Operações/Logs/LLM/Analytics/Monitor).
              { title: "Runtime", href: "/admin/runtime", icon: Activity },
              { title: "Tarefas", href: "/admin/tasks", icon: ListTodo },
              // Session 21 Fase 3 — curated ingest for 5 Qdrant collections
              { title: "Curated Ingest", href: "/admin/curated-ingest", icon: Database },
            ],
          },
          {
            title: "SEO Tools",
            icon: BarChart3,
            children: [
              { title: "GSC", href: "/admin/gsc", icon: BarChart3 },
              { title: "Auto-actions", href: "/admin/auto-actions", icon: Activity },
              { title: "Domain Lists", href: "/admin/domain-lists", icon: ListTodo },
              { title: "Concorrentes", href: "/admin/competitors", icon: Users },
              { title: "Competitor Pages", href: "/admin/competitor-pages", icon: ScrollText },
            ],
          },
          {
            title: "Config",
            icon: Wrench,
            children: [
              { title: "Engine Config", href: "/admin/config/engine", icon: Wrench },
              { title: "Custos", href: "/admin/config/costs", icon: DollarSign },
              { title: "Proxy", href: "/admin/config/proxy", icon: Wrench },
              { title: "Ligas", href: "/admin/config/leagues", icon: ListTodo },
              { title: "Usuarios", href: "/admin/config/users", icon: Users },
            ],
          },
        ],
      },
    ],
  },
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

function NavLink({
  item,
  pathname,
  onClose,
}: {
  item: NavItem;
  pathname: string;
  onClose?: () => void;
}) {
  const isActive =
    pathname === item.href || pathname.startsWith(item.href + "/");
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <item.icon className="h-4 w-4" />
      {item.title}
    </Link>
  );
}

// Renders a single NavEntry — dispatches to NavLink or NavGroupItem.
// Keeping this as a named function avoids inline ternaries in the parent JSX.
function NavEntryRenderer({
  entry,
  pathname,
  onClose,
  depth,
}: {
  entry: NavEntry;
  pathname: string;
  onClose?: () => void;
  depth: number;
}) {
  if (isGroup(entry)) {
    return (
      <NavGroupItem
        group={entry}
        pathname={pathname}
        onClose={onClose}
        depth={depth}
      />
    );
  }
  return <NavLink item={entry} pathname={pathname} onClose={onClose} />;
}

// depth controls left-indent progression for nested groups (0 = top, 1 = sub).
function NavGroupItem({
  group,
  pathname,
  onClose,
  depth = 0,
}: {
  group: NavGroup;
  pathname: string;
  onClose?: () => void;
  depth?: number;
}) {
  const hasActive = group.children.some((c) => hasActiveDescendant(c, pathname));
  const [open, setOpen] = useState(hasActive);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          hasActive
            ? "text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <group.icon className="h-4 w-4" />
        {group.title}
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
          {group.children.map((child, i) => (
            <NavEntryRenderer
              key={isGroup(child) ? `group-${child.title}-${i}` : child.href}
              entry={child}
              pathname={pathname}
              onClose={onClose}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
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
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4 scrollbar-none">
        {navSections.map((section, idx) => (
          <div key={section.label || `section-${idx}`}>
            {section.label && (
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((entry, i) => (
                <NavEntryRenderer
                  key={isGroup(entry) ? `group-${entry.title}-${i}` : entry.href}
                  entry={entry}
                  pathname={pathname}
                  onClose={onClose}
                  depth={0}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-3 py-2 space-y-1 border-t border-border">
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
