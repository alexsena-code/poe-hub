"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TaskPriorityBadge } from "./task-priority-badge";
import { Badge } from "@/components/ui/badge";
import { TaskDetailDialog } from "./task-detail-dialog";
import type { Task } from "./task-card";
import type { TaskPriority } from "./task-priority-badge";

const statusLabels: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "Em Progresso",
  done: "Concluido",
};

const moduleLabels: Record<string, string> = {
  bots: "Bots",
  prices: "Precos",
  sales: "Vendas",
  simulations: "Simulacoes",
  infra: "Infra",
  other: "Outro",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

interface TaskListProps {
  filters?: {
    priority?: string;
    assignedTo?: string;
    module?: string;
    status?: string;
  };
}

type SortField = "title" | "priority" | "status" | "dueDate" | "createdAt";
type SortDir = "asc" | "desc";

const priorityOrder: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function TaskList({ filters }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(filters?.status ?? "all");
  const [priorityFilter, setPriorityFilter] = useState(
    filters?.priority ?? "all"
  );
  const [moduleFilter, setModuleFilter] = useState(filters?.module ?? "all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const limit = 20;

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (moduleFilter !== "all") params.set("module", moduleFilter);
      if (filters?.assignedTo) params.set("assignedTo", filters.assignedTo);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar tarefas");

      const json = await res.json();
      setTasks(json.data ?? []);
      setTotalPages(json.pagination?.totalPages ?? 1);
    } catch {
      toast.error("Erro ao carregar tarefas");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, priorityFilter, moduleFilter, filters?.assignedTo, search]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, priorityFilter, moduleFilter, search]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;

    switch (sortField) {
      case "title":
        return a.title.localeCompare(b.title) * dir;
      case "priority":
        return (
          ((priorityOrder[a.priority] ?? 99) -
            (priorityOrder[b.priority] ?? 99)) *
          dir
        );
      case "status":
        return a.status.localeCompare(b.status) * dir;
      case "dueDate": {
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return (aDate - bDate) * dir;
      }
      case "createdAt":
        return (
          (new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime()) *
          dir
        );
      default:
        return 0;
    }
  });

  function SortHeader({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) {
    return (
      <TableHead>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8"
          onClick={() => toggleSort(field)}
        >
          {children}
          <ArrowUpDown className="ml-1 size-3" />
        </Button>
      </TableHead>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar tarefas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-64"
        />

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="backlog">Backlog</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">Em Progresso</SelectItem>
            <SelectItem value="done">Concluido</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas prioridades</SelectItem>
            <SelectItem value="low">Baixa</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="urgent">Urgente</SelectItem>
          </SelectContent>
        </Select>

        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Modulo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos modulos</SelectItem>
            <SelectItem value="bots">Bots</SelectItem>
            <SelectItem value="prices">Precos</SelectItem>
            <SelectItem value="sales">Vendas</SelectItem>
            <SelectItem value="simulations">Simulacoes</SelectItem>
            <SelectItem value="infra">Infra</SelectItem>
            <SelectItem value="other">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" className="text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader field="title">Titulo</SortHeader>
                  <SortHeader field="status">Status</SortHeader>
                  <SortHeader field="priority">Prioridade</SortHeader>
                  <TableHead>Modulo</TableHead>
                  <TableHead>Responsavel</TableHead>
                  <SortHeader field="dueDate">Data Limite</SortHeader>
                  <SortHeader field="createdAt">Criada em</SortHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTasks.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Nenhuma tarefa encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedTasks.map((task) => (
                    <TableRow
                      key={task.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedTask(task);
                        setDetailOpen(true);
                      }}
                    >
                      <TableCell className="max-w-[300px] font-medium">
                        <span className="line-clamp-1">{task.title}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {statusLabels[task.status] ?? task.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TaskPriorityBadge
                          priority={task.priority as TaskPriority}
                        />
                      </TableCell>
                      <TableCell>
                        {task.module ? (
                          <Badge variant="secondary" className="text-xs">
                            {moduleLabels[task.module] ?? task.module}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.assignee?.username ?? (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.dueDate ? (
                          formatDate(task.dueDate)
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(task.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Pagina {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="mr-1 size-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Proxima
                  <ChevronRight className="ml-1 size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <TaskDetailDialog
        task={selectedTask}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={fetchTasks}
        onDeleted={fetchTasks}
      />
    </>
  );
}
