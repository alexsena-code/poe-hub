"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChipEditor } from "./chip-editor";
import {
  LIST_LABEL,
  LIST_TYPE_ORDER,
  type DomainListsAll,
  type ListType,
} from "./types";

interface DomainListsEditorProps {
  initialLists: DomainListsAll;
}

type DirtyMap = Record<ListType, boolean>;

const NO_DIRTY: DirtyMap = {
  "off-topic": false,
  "social": false,
  "marketplace-rmt": false,
  "generic-news": false,
};

export function DomainListsEditor({ initialLists }: DomainListsEditorProps) {
  const [lists, setLists] = useState<DomainListsAll>(initialLists);
  const [savedSnapshot, setSavedSnapshot] = useState<DomainListsAll>(initialLists);
  const [dirty, setDirty] = useState<DirtyMap>(NO_DIRTY);
  const [active, setActive] = useState<ListType>("off-topic");

  function handleChange(listType: ListType, next: string[]) {
    setLists((prev) => ({ ...prev, [listType]: next }));
    const wasSaved = savedSnapshot[listType];
    const isDirtyNow =
      next.length !== wasSaved.length || next.some((d, i) => d !== wasSaved[i]);
    setDirty((prev) => ({ ...prev, [listType]: isDirtyNow }));
  }

  function handleSaved(listType: ListType, next: string[]) {
    setSavedSnapshot((prev) => ({ ...prev, [listType]: next }));
    setDirty((prev) => ({ ...prev, [listType]: false }));
  }

  return (
    <Tabs value={active} onValueChange={(v) => setActive(v as ListType)}>
      <TabsList className="w-full justify-start">
        {LIST_TYPE_ORDER.map((lt) => (
          <TabsTrigger key={lt} value={lt} className="data-[state=active]:font-semibold">
            {LIST_LABEL[lt]}
            <span className="ml-2 rounded bg-foreground/10 px-1.5 py-0.5 text-xs text-muted-foreground">
              {lists[lt].length}
            </span>
            {dirty[lt] && (
              <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" aria-label="Dirty" />
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      {LIST_TYPE_ORDER.map((lt) => (
        <TabsContent
          key={lt}
          value={lt}
          className="rounded-lg border border-border bg-surface p-4"
          forceMount
          hidden={active !== lt}
        >
          <ChipEditor
            listType={lt}
            domains={lists[lt]}
            dirty={dirty[lt]}
            onChange={(next) => handleChange(lt, next)}
            onSaved={(next) => handleSaved(lt, next)}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
