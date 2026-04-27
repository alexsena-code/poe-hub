"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

export function CompetitorFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local state for debounced search
  const [search, setSearch] = useState(searchParams.get("search") || "");

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      params.delete("page"); // Reset page when filtering
      return params.toString();
    },
    [searchParams]
  );

  const handleFilterChange = (key: string, value: string) => {
    router.push(`?${createQueryString(key, value)}`);
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== searchParams.get("search")) {
        router.push(`?${createQueryString("search", search)}`);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search, router, createQueryString, searchParams]);

  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-surface/50 border border-border/50 rounded-lg backdrop-blur-sm">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título ou URL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-background/50 border-border/50 focus-visible:ring-1"
        />
      </div>

      <div className="flex flex-wrap gap-2 md:flex-nowrap">
        <Select
          value={searchParams.get("domain") || "all"}
          onValueChange={(val) => handleFilterChange("domain", val === "all" ? "" : val)}
        >
          <SelectTrigger className="w-[160px] bg-background/50 border-border/50">
            <SelectValue placeholder="Concorrente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Sites</SelectItem>
            <SelectItem value="maxroll.gg">maxroll.gg</SelectItem>
            <SelectItem value="poe-vault.com">poe-vault.com</SelectItem>
            <SelectItem value="mobalytics.gg">mobalytics.gg</SelectItem>
            <SelectItem value="zizaran.com">zizaran.com</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("longevity") || "all"}
          onValueChange={(val) => handleFilterChange("longevity", val === "all" ? "" : val)}
        >
          <SelectTrigger className="w-[150px] bg-background/50 border-border/50">
            <SelectValue placeholder="Longevity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo o Tempo</SelectItem>
            <SelectItem value="evergreen">Evergreen</SelectItem>
            <SelectItem value="patch-specific">Patch-Specific</SelectItem>
            <SelectItem value="outdated">Outdated</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("isPoeRelated") || "all"}
          onValueChange={(val) => handleFilterChange("isPoeRelated", val === "all" ? "" : val)}
        >
          <SelectTrigger className="w-[140px] bg-background/50 border-border/50">
            <SelectValue placeholder="Relevância" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Relevante (PoE)</SelectItem>
            <SelectItem value="false">Off-topic</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("sortBy") || "lastCrawledAt"}
          onValueChange={(val) => handleFilterChange("sortBy", val)}
        >
          <SelectTrigger className="w-[160px] bg-background/50 border-border/50">
            <SelectValue placeholder="Ordernar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lastCrawledAt">Visto Recentemente</SelectItem>
            <SelectItem value="pageUpdatedAt">Atualizado na Fonte</SelectItem>
            <SelectItem value="createdAt">Descoberto</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
