"use client";

import { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SecretFieldProps {
  value: string;
  masked?: string;
  onReveal?: () => Promise<string>;
}

export function SecretField({ value, masked = "••••••••", onReveal }: SecretFieldProps) {
  const [visible, setVisible] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const displayValue = visible ? (revealed ?? value) : masked;
  const isMasked = displayValue === masked;

  async function handleToggle() {
    if (!visible && onReveal && !revealed) {
      const val = await onReveal();
      setRevealed(val);
    }
    setVisible(!visible);
  }

  async function handleCopy() {
    const val = revealed ?? value;
    await navigator.clipboard.writeText(val);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-sm">{displayValue}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={handleToggle}
        type="button"
      >
        {visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </Button>
      {!isMasked && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCopy}
          type="button"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      )}
    </div>
  );
}
