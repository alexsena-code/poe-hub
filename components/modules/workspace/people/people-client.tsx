'use client';

import { useState, useCallback } from 'react';

const API_URL = '/api/engine';

export interface Person {
  id: number;
  name: string;
  aliases: string[];
  role: string | null;
  category: string;
  relevance: string;
  createdAt: string;
}

const CATEGORIES = ['community', 'ggg', 'creator'] as const;
const RELEVANCES = ['high', 'medium', 'low'] as const;

function categoryColor(cat: string): string {
  switch (cat) {
    case 'ggg': return 'bg-amber-900/40 text-amber-300';
    case 'community': return 'bg-purple-900/40 text-purple-300';
    case 'creator': return 'bg-blue-900/40 text-blue-300';
    default: return 'bg-surface text-muted-foreground';
  }
}

function relevanceColor(rel: string): string {
  switch (rel) {
    case 'high': return 'text-emerald-400';
    case 'medium': return 'text-amber-400';
    case 'low': return 'text-muted-foreground';
    default: return 'text-muted-foreground';
  }
}

interface PeopleClientProps {
  initialPeople: Person[];
}

export function PeopleClient({ initialPeople }: PeopleClientProps) {
  const [people, setPeople] = useState<Person[]>(initialPeople);
  const [filter, setFilter] = useState<string>('all');

  // Add form state
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState('');
  const [role, setRole] = useState('');
  const [category, setCategory] = useState<string>('community');
  const [relevance, setRelevance] = useState<string>('medium');
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Edit state
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string; aliases: string; role: string; category: string; relevance: string;
  }>({ name: '', aliases: '', role: '', category: 'community', relevance: 'medium' });
  const [saving, setSaving] = useState(false);

  // Add form visibility
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchPeople = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/seo/people`);
      if (res.ok) {
        const data = await res.json();
        setPeople(Array.isArray(data) ? data : []);
      }
    } catch { /* silent — operator will notice empty list */ }
  }, []);

  async function handleAdd() {
    if (!name.trim() || !category) return;
    setAdding(true);
    setMsg(null);
    try {
      const res = await fetch(`${API_URL}/seo/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim().toLowerCase().replace(/\s+/g, '_'),
          aliases: aliases.split(',').map(a => a.trim().toLowerCase()).filter(Boolean),
          role: role.trim() || undefined,
          category,
          relevance,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setMsg(data.error);
      } else {
        setMsg(`Added ${name.trim()}`);
        setName(''); setAliases(''); setRole('');
        fetchPeople();
      }
    } catch { setMsg('Failed to add'); }
    setAdding(false);
  }

  async function handleSeed() {
    setMsg(null);
    try {
      const res = await fetch(`${API_URL}/seo/people/seed`, { method: 'POST' });
      const data = await res.json();
      setMsg(`Seeded: ${data.seeded} added, ${data.skipped} skipped`);
      fetchPeople();
    } catch { setMsg('Seed failed'); }
  }

  function startEdit(p: Person) {
    setEditingName(p.name);
    setEditForm({
      name: p.name,
      aliases: p.aliases.join(', '),
      role: p.role || '',
      category: p.category,
      relevance: p.relevance,
    });
  }

  function cancelEdit() { setEditingName(null); }

  async function handleSave() {
    if (!editingName) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`${API_URL}/seo/people/${encodeURIComponent(editingName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim().toLowerCase().replace(/\s+/g, '_'),
          aliases: editForm.aliases.split(',').map(a => a.trim().toLowerCase()).filter(Boolean),
          role: editForm.role.trim() || null,
          category: editForm.category,
          relevance: editForm.relevance,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setMsg(data.error);
      } else {
        setMsg(`Updated ${editForm.name.trim()}`);
        setEditingName(null);
        fetchPeople();
      }
    } catch { setMsg('Failed to save'); }
    setSaving(false);
  }

  async function handleRemove(personName: string) {
    try {
      await fetch(`${API_URL}/seo/people/${encodeURIComponent(personName)}`, { method: 'DELETE' });
      setConfirmDelete(null);
      fetchPeople();
    } catch { /* silent — list will be stale, re-fetch on next refresh */ }
  }

  const filtered = filter === 'all' ? people : people.filter(p => p.category === filter);
  const counts = {
    all: people.length,
    community: people.filter(p => p.category === 'community').length,
    ggg: people.filter(p => p.category === 'ggg').length,
    creator: people.filter(p => p.category === 'creator').length,
  };

  return (
    <div className="flex flex-col h-full max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="shrink-0 pb-4">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">PoE People Whitelist</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Important community figures, GGG staff, and creators. Used for keyword normalization and boosting.
            </p>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</div>
                <div className="text-lg font-bold text-foreground">{counts.all}</div>
              </div>
              <div className="w-px h-8 bg-border" />
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Community</div>
                <div className="text-lg font-bold text-purple-400">{counts.community}</div>
              </div>
              <div className="w-px h-8 bg-border" />
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">GGG</div>
                <div className="text-lg font-bold text-amber-400">{counts.ggg}</div>
              </div>
              <div className="w-px h-8 bg-border" />
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Creator</div>
                <div className="text-lg font-bold text-blue-400">{counts.creator}</div>
              </div>
            </div>

            <div className="w-px h-8 bg-border" />

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-sm font-medium text-white transition-colors"
            >
              {showAddForm ? 'Cancel' : 'Add Person'}
            </button>
            {people.length > 0 && (
              <button
                onClick={handleSeed}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Re-seed
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mt-4">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['all', ...CATEGORIES] as const).map(c => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`px-3 py-1.5 text-xs capitalize transition-colors ${
                  filter === c
                    ? 'bg-foreground/10 text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {c} ({counts[c as keyof typeof counts] ?? 0})
              </button>
            ))}
          </div>
        </div>

        {msg && <div className="text-xs text-emerald-400 mt-2">{msg}</div>}
      </div>

      {/* Seed button (first run only) */}
      {people.length === 0 && (
        <div className="bg-surface border border-border rounded-lg p-4 mb-4 text-center shrink-0">
          <p className="text-sm text-muted-foreground mb-2">No people in database yet.</p>
          <button
            onClick={handleSeed}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm transition-colors"
          >
            Seed from config + YouTube channels
          </button>
        </div>
      )}

      {/* Add form (collapsible) */}
      {showAddForm && (
        <div className="bg-surface border border-border rounded-lg p-4 mb-4 shrink-0">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Add Person</div>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-muted-foreground block mb-1">Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="jenebu"
                className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground block mb-1">Aliases (comma-separated)</label>
              <input
                value={aliases}
                onChange={e => setAliases(e.target.value)}
                placeholder="janeu, jean bureau"
                className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50"
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs text-muted-foreground block mb-1">Role</label>
              <input
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder="Former TFT owner"
                className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50"
              />
            </div>
            <div className="w-32">
              <label className="text-xs text-muted-foreground block mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="w-28">
              <label className="text-xs text-muted-foreground block mb-1">Relevance</label>
              <select
                value={relevance}
                onChange={e => setRelevance(e.target.value)}
                className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground"
              >
                {RELEVANCES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <button
              onClick={handleAdd}
              disabled={adding || !name.trim()}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded text-sm font-medium text-white transition-colors"
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* People table */}
      <div className="flex-1 min-h-0 overflow-auto scrollbar-none">
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Aliases</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2 w-24">Category</th>
                <th className="px-3 py-2 w-20">Relevance</th>
                <th className="px-3 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    No people found.
                  </td>
                </tr>
              ) : (
                filtered.map(p =>
                  editingName === p.name ? (
                    <tr key={p.id} className="border-b border-border/50 bg-surface">
                      <td className="px-3 py-2">
                        <input
                          value={editForm.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={editForm.aliases}
                          onChange={e => setEditForm(f => ({ ...f, aliases: e.target.value }))}
                          className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
                          placeholder="alias1, alias2"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={editForm.role}
                          onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                          className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={editForm.category}
                          onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                          className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
                        >
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={editForm.relevance}
                          onChange={e => setEditForm(f => ({ ...f, relevance: e.target.value }))}
                          className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
                        >
                          {RELEVANCES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-2 py-0.5 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-40"
                          >
                            {saving ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-2 py-0.5 text-[10px] bg-surface-hover text-muted-foreground rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={p.id}
                      className="border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer"
                      onDoubleClick={() => startEdit(p)}
                    >
                      <td className="px-3 py-2 font-medium text-foreground">{p.name}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {p.aliases.map(a => (
                            <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/5 text-muted-foreground">
                              {a}
                            </span>
                          ))}
                          {p.aliases.length === 0 && <span className="text-muted-foreground">-</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{p.role || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${categoryColor(p.category)}`}>
                          {p.category}
                        </span>
                      </td>
                      <td className={`px-3 py-2 text-xs ${relevanceColor(p.relevance)}`}>
                        {p.relevance}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => startEdit(p)}
                            className="text-[10px] text-blue-400/50 hover:text-blue-400 transition-colors"
                          >
                            Edit
                          </button>
                          {confirmDelete === p.name ? (
                            <>
                              <button
                                onClick={() => handleRemove(p.name)}
                                className="px-2 py-0.5 text-[10px] bg-red-600 text-white rounded"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="px-2 py-0.5 text-[10px] bg-surface-hover text-muted-foreground rounded"
                              >
                                No
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(p.name)}
                              className="text-[10px] text-red-400/50 hover:text-red-400 transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
