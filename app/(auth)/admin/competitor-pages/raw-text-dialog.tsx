"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const PREVIEW_CHARS = 200;

interface RawTextDialogProps {
  rawText: string;
  title: string;
}

export function RawTextDialog({ rawText, title }: RawTextDialogProps) {
  const [open, setOpen] = useState(false);
  const preview = rawText.slice(0, PREVIEW_CHARS);
  const isTruncated = rawText.length > PREVIEW_CHARS;

  return (
    <div className="flex items-start gap-2 min-w-0">
      <span className="text-xs text-muted-foreground font-mono truncate max-w-[240px]">
        {preview}
        {isTruncated && "…"}
      </span>
      {isTruncated && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 h-5 px-1.5 text-[10px] text-blue-400 hover:text-blue-300"
            >
              ver tudo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[70vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-sm truncate">{title}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto mt-2">
              <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-words leading-relaxed">
                {rawText}
              </pre>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
