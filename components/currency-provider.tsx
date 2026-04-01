"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type DisplayCurrency = "usd" | "brl";

interface ExchangeRateResponse {
  rate: number;
  updatedAt: string;
}

interface CurrencyContextValue {
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
  exchangeRate: number;
  convert: (value: number, fromCurrency: DisplayCurrency) => number;
  formatMoney: (value: number, fromCurrency: DisplayCurrency) => string;
  loading: boolean;
}

const STORAGE_KEY = "poe-hub-display-currency";
const FALLBACK_RATE = 5.0;

export const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [displayCurrency, setDisplayCurrencyState] =
    useState<DisplayCurrency>("usd");
  const [exchangeRate, setExchangeRate] = useState<number>(FALLBACK_RATE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "usd" || stored === "brl") {
      setDisplayCurrencyState(stored);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/exchange-rate")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch exchange rate");
        return res.json() as Promise<ExchangeRateResponse>;
      })
      .then((data) => {
        if (!cancelled) {
          setExchangeRate(data.rate);
        }
      })
      .catch(() => {
        // keep fallback rate already set in state
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setDisplayCurrency = useCallback((currency: DisplayCurrency) => {
    setDisplayCurrencyState(currency);
    localStorage.setItem(STORAGE_KEY, currency);
  }, []);

  const convert = useCallback(
    (value: number, fromCurrency: DisplayCurrency): number => {
      if (fromCurrency === displayCurrency) return value;
      if (fromCurrency === "usd" && displayCurrency === "brl") {
        return value * exchangeRate;
      }
      // fromCurrency === "brl" && displayCurrency === "usd"
      return value / exchangeRate;
    },
    [displayCurrency, exchangeRate]
  );

  const formatMoney = useCallback(
    (value: number, fromCurrency: DisplayCurrency): string => {
      const converted = convert(value, fromCurrency);

      if (displayCurrency === "usd") {
        return converted.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      }

      return (
        "R$ " +
        converted.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    },
    [convert, displayCurrency]
  );

  return (
    <CurrencyContext.Provider
      value={{
        displayCurrency,
        setDisplayCurrency,
        exchangeRate,
        convert,
        formatMoney,
        loading,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrencyContext(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (ctx === null) {
    throw new Error("useCurrencyContext must be used within a CurrencyProvider");
  }
  return ctx;
}
