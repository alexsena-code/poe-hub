"use client";

import { MonitorDashboard } from "@/components/modules/monitor/monitor-dashboard";

// Thin wrapper so the observability page can lazy-load the monitor tab
// symmetrically with the other tabs. The real logic lives in
// components/modules/monitor/monitor-dashboard.tsx.
export default function MonitorTab() {
  return <MonitorDashboard />;
}
