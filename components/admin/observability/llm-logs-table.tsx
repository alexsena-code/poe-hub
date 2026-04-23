"use client";

import { Fragment, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, XCircle } from "lucide-react";
import {
  ContentBlock,
  fmt,
  fmtTokens,
  formatTime,
  type LogDetail,
  type LogEntry,
  type Pagination,
} from "./llm-logs-shared";

const API = '/api/engine';

interface LlmLogsTableProps {
  logs: LogEntry[];
  pagination: Pagination;
  page: number;
  setPage: (fn: (prev: number) => number) => void;
  filterNode: string;
  setFilterNode: (v: string) => void;
  filterProvider: string;
  setFilterProvider: (v: string) => void;
  filterSuccess: '' | 'true' | 'false';
  setFilterSuccess: (v: '' | 'true' | 'false') => void;
  loading: boolean;
  nodeNames: string[];
  providers: string[];
}

export function LlmLogsTable(props: LlmLogsTableProps) {
  const {
    logs, pagination, page, setPage,
    filterNode, setFilterNode, filterProvider, setFilterProvider,
    filterSuccess, setFilterSuccess, loading, nodeNames, providers,
  } = props;

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<LogDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function toggleExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(id);
    setExpandedDetail(null);
    setLoadingDetail(true);
    try {
      const res = await fetch(`${API}/llm/logs/${id}`);
      if (!res.ok) throw new Error(`Detail API: ${res.status}`);
      setExpandedDetail(await res.json());
    } catch {
      // silent — stays on "Failed to load details"
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">Log Entries</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterNode}
          onChange={(e) => setFilterNode(e.target.value)}
          className="bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">All Nodes</option>
          {nodeNames.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>

        <select
          value={filterProvider}
          onChange={(e) => setFilterProvider(e.target.value)}
          className="bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">All Providers</option>
          {providers.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select
          value={filterSuccess}
          onChange={(e) => setFilterSuccess(e.target.value as '' | 'true' | 'false')}
          className="bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">All Status</option>
          <option value="true">Success</option>
          <option value="false">Errors</option>
        </select>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm py-4">Loading logs...</div>
      ) : logs.length === 0 ? (
        <div className="text-muted-foreground text-sm py-4">No log entries found.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="py-2 pr-3 w-6"></th>
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Node</th>
                  <th className="py-2 pr-4">Provider / Model</th>
                  <th className="py-2 pr-4 text-right">Tokens In</th>
                  <th className="py-2 pr-4 text-right">Tokens Out</th>
                  <th className="py-2 pr-4 text-right">Cost</th>
                  <th className="py-2 pr-4 text-right">Latency</th>
                  <th className="py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <Fragment key={log.id}>
                    <tr
                      onClick={() => toggleExpand(log.id)}
                      className={`border-b border-border/50 cursor-pointer transition-colors hover:bg-background/50 ${
                        !log.success ? 'bg-red-500/5' : ''
                      } ${expandedId === log.id ? 'bg-background/50' : ''}`}
                    >
                      <td className="py-2 pr-3 text-muted-foreground">
                        {expandedId === log.id ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground text-xs whitespace-nowrap">
                        {formatTime(log.createdAt)}
                      </td>
                      <td className="py-2 pr-4 text-foreground font-mono text-xs">{log.nodeName}</td>
                      <td className="py-2 pr-4 text-foreground font-mono text-xs">
                        {log.provider}/{log.model}
                      </td>
                      <td className="py-2 pr-4 text-right text-sky-400">{fmtTokens(log.inputTokens)}</td>
                      <td className="py-2 pr-4 text-right text-amber-400">{fmtTokens(log.outputTokens)}</td>
                      <td className="py-2 pr-4 text-right text-emerald-400">${fmt(log.costUsd, 5)}</td>
                      <td className="py-2 pr-4 text-right text-muted-foreground">{log.latencyMs}ms</td>
                      <td className="py-2 text-center">
                        {log.success ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 inline-block" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400 inline-block" />
                        )}
                      </td>
                    </tr>

                    {expandedId === log.id && (
                      <tr>
                        <td colSpan={9} className="p-0">
                          <div className="bg-background/80 border-b border-border p-4 space-y-3">
                            {loadingDetail ? (
                              <div className="text-muted-foreground text-sm">Loading details...</div>
                            ) : expandedDetail ? (
                              <>
                                {!expandedDetail.success && expandedDetail.errorMessage && (
                                  <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3 text-sm text-red-400">
                                    <span className="font-semibold">Error:</span> {expandedDetail.errorMessage}
                                  </div>
                                )}
                                <ContentBlock label="System Prompt" content={expandedDetail.systemPrompt} />
                                <ContentBlock label="User Message" content={expandedDetail.userMessage} />
                                <ContentBlock label="Response" content={expandedDetail.response} />
                              </>
                            ) : (
                              <div className="text-muted-foreground text-sm">Failed to load details.</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 text-sm">
            <div className="text-muted-foreground">
              Showing {(pagination.page - 1) * pagination.limit + 1}
              {' '}-{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)}
              {' '}of {pagination.total}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 rounded border border-border text-foreground disabled:opacity-40 hover:bg-background transition-colors"
              >
                Prev
              </button>
              <span className="px-3 py-1 text-muted-foreground">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="px-3 py-1 rounded border border-border text-foreground disabled:opacity-40 hover:bg-background transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
