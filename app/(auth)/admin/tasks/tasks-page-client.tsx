"use client";

import { useState } from "react";
import { LayoutGrid, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { KanbanBoard } from "@/components/modules/tasks/kanban-board";
import { TaskList } from "@/components/modules/tasks/task-list";
import { TaskCreateForm } from "@/components/modules/tasks/task-create-form";

type ViewMode = "kanban" | "list";

export function TasksPageClient() {
  const [view, setView] = useState<ViewMode>("kanban");
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleCreated() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tarefas"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border">
              <Button
                variant={view === "kanban" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-r-none"
                onClick={() => setView("kanban")}
              >
                <LayoutGrid className="mr-1 size-4" />
                Kanban
              </Button>
              <Button
                variant={view === "list" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-l-none"
                onClick={() => setView("list")}
              >
                <List className="mr-1 size-4" />
                Lista
              </Button>
            </div>

            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 size-4" />
              Nova Tarefa
            </Button>
          </div>
        }
      />

      {view === "kanban" ? (
        <KanbanBoard key={`kanban-${refreshKey}`} />
      ) : (
        <TaskList key={`list-${refreshKey}`} />
      )}

      <TaskCreateForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}
