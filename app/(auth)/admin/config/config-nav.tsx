"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Wrench,
  DollarSign,
  Trophy,
  Globe,
  Users,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavEntry = {
  href: string;
  label: string;
  icon: LucideIcon;
  /**
   * How pathname active-match is computed. "exact" = pathname === href;
   * "prefix" = pathname.startsWith(href + "/") or pathname === href.
   * Overview uses "exact" so it only lights up on the landing page,
   * everything else uses "prefix" so deeper routes keep their tab hot.
   */
  match?: "exact" | "prefix";
};

const ENTRIES: NavEntry[] = [
  { href: "/admin/config", label: "Overview", icon: LayoutGrid, match: "exact" },
  { href: "/admin/config/engine", label: "Engine", icon: Wrench },
  { href: "/admin/config/costs", label: "Custos", icon: DollarSign },
  { href: "/admin/config/leagues", label: "Ligas", icon: Trophy },
  { href: "/admin/config/proxy", label: "Proxy", icon: Globe },
  { href: "/admin/config/users", label: "Usuarios", icon: Users },
];

function isActive(pathname: string, entry: NavEntry): boolean {
  if (entry.match === "exact") return pathname === entry.href;
  return pathname === entry.href || pathname.startsWith(entry.href + "/");
}

export function ConfigNav() {
  const pathname = usePathname();
  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-border pb-px"
      aria-label="Config sections"
    >
      {ENTRIES.map((entry) => {
        const active = isActive(pathname, entry);
        return (
          <Link
            key={entry.href}
            href={entry.href}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <entry.icon className="h-4 w-4" />
            {entry.label}
          </Link>
        );
      })}
    </nav>
  );
}
