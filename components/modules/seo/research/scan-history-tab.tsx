'use client';

// Scan History tab — list of engine keyword scans with metrics.
// Dates rendered dd/mm/yyyy pt-BR per operator convention.

import React from 'react';
import { sourceVariant, formatDatetimeBR } from '../shared/helpers';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ScanResult } from '../shared/types';

interface ScanHistoryTabProps {
  scans: ScanResult[];
}

export function ScanHistoryTab({ scans }: ScanHistoryTabProps) {
  return (
    <div className="overflow-x-auto border border-border rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2 w-20 text-right">Found</th>
            <th className="px-3 py-2 w-20 text-right">New</th>
            <th className="px-3 py-2 w-20 text-right">Rejected</th>
            <th className="px-3 py-2 w-20 text-right">Duration</th>
            <th className="px-3 py-2 w-40">Date</th>
          </tr>
        </thead>
        <tbody>
          {scans.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                No scans yet.
              </td>
            </tr>
          ) : (
            scans.map((scan) => (
              <tr key={scan.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                <td className="px-3 py-2">
                  <StatusBadge variant={sourceVariant(scan.scanType.split('_')[0])}>
                    {scan.scanType}
                  </StatusBadge>
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-foreground">
                  {scan.keywordsFound}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-emerald-400">
                  {scan.newKeywords}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-red-400">
                  {scan.rejected}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                  {scan.durationMs ? `${(scan.durationMs / 1000).toFixed(1)}s` : '-'}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {formatDatetimeBR(scan.runAt)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
