"use client";

import { useState, useEffect } from "react";

interface League {
  id: string;
  name: string;
  poeVersion: string;
  isCurrent: boolean;
  startDate: string | null;
  endDate: string | null;
}

export function useLeagues() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leagues")
      .then((res) => res.json())
      .then((data) => setLeagues(Array.isArray(data) ? data : []))
      .catch(() => setLeagues([]))
      .finally(() => setLoading(false));
  }, []);

  const activeLeagues = leagues.filter((l) => l.isCurrent);

  return { leagues, activeLeagues, loading };
}
