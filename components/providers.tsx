"use client";

import { SessionProvider } from "next-auth/react";
import { CurrencyProvider } from "@/components/currency-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CurrencyProvider>{children}</CurrencyProvider>
    </SessionProvider>
  );
}
