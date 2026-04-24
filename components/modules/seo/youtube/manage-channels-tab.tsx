'use client';

// ---------------------------------------------------------------------------
// ManageChannelsTab — add / remove monitored YouTube channels
// ---------------------------------------------------------------------------

import { useState, useCallback, useEffect } from 'react';
import { channelColor } from './helpers';
import { Tip, YtBadge } from './primitives';
import type { MonitoredChannel } from './types';

const API_URL = '/api/engine';

export function ManageChannelsTab() {
  const [channels, setChannels] = useState<MonitoredChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState('');
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/seo/youtube/channels`);
      if (res.ok) setChannels(await res.json());
    } catch { /* API offline */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  async function handleAdd() {
    if (!name.trim() || !channelId.trim()) return;
    setAdding(true);
    setMsg(null);
    try {
      const res = await fetch(`${API_URL}/seo/youtube/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          channel_id: channelId.trim(),
          youtube_url: url.trim(),
        }),
      });
      const data = await res.json();
      if (data.error) {
        setMsg(data.error);
      } else {
        setMsg(`${name.trim()} added`);
        setName('');
        setChannelId('');
        setUrl('');
        fetchChannels();
      }
    } catch {
      setMsg('Failed to add channel');
    }
    setAdding(false);
  }

  async function handleRemove(id: string) {
    try {
      await fetch(`${API_URL}/seo/youtube/channels`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: id }),
      });
      setConfirmDelete(null);
      fetchChannels();
    } catch { /* API offline */ }
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">Loading channels...</div>
    );
  }

  return (
    <div>
      {/* Add channel form */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Add Channel</div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="text-xs text-muted-foreground block mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="CuteDog"
              className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground block mb-1">
              <Tip text="The UC... ID from the channel URL: youtube.com/channel/UC...">
                Channel ID
              </Tip>
            </label>
            <input
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="UCkTd_0qajBqsLiVKzERtv1Q"
              className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground font-mono placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground block mb-1">
              YouTube URL (optional)
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/@CuteDog_"
              className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !name.trim() || !channelId.trim()}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded text-sm font-medium text-white transition-colors"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </div>
        {msg && <div className="text-xs text-emerald-400 mt-2">{msg}</div>}
      </div>

      {/* Channel grid */}
      <div className="text-xs text-muted-foreground mb-2">{channels.length} channels monitored</div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {channels.map((ch) => {
          const resolvedId = ch.channelId || ch.channel_id || '';
          const isConfirmingDelete = confirmDelete === resolvedId;
          return (
            <div
              key={ch.channelId || ch.channel_id || ch.name}
              className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <YtBadge className={channelColor(ch.name)}>{ch.name}</YtBadge>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono mt-1">
                  {ch.channelId || ch.channel_id}
                </div>
              </div>
              {isConfirmingDelete ? (
                <div className="flex gap-1">
                  <button
                    onClick={() => handleRemove(resolvedId)}
                    className="px-2 py-1 text-[10px] bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="px-2 py-1 text-[10px] bg-surface-hover text-muted-foreground rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(resolvedId)}
                  className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
