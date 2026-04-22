'use client';

import type { PobSummary, PobAlternateLoadout } from '@/lib/engine-types';

interface PobSummaryCardProps {
  summary: PobSummary;
  /** Callback quando o autor quer recolher o card (opcional). */
  onDismiss?: () => void;
}

function Tag({ label, value }: { label: string; value: string | number | undefined | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border bg-background/40 px-2 py-0.5 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}

function GemList({ label, items, color }: { label: string; items?: string[]; color: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-1.5 text-[11px]">
      <span className={`font-semibold ${color}`}>{label}:</span>
      {items.map((name) => (
        <span
          key={name}
          className="rounded bg-background/40 px-1.5 py-0.5 text-foreground"
        >
          {name}
        </span>
      ))}
    </div>
  );
}

function LoadoutBlock({ loadout }: { loadout: PobAlternateLoadout }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/30 p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="inline-block rounded bg-purple-950/40 border border-purple-700/40 px-1.5 py-0.5 text-[10px] font-mono uppercase text-purple-300">
          loadout {loadout.id}
        </span>
        <span className="text-xs font-semibold text-foreground">{loadout.title}</span>
      </div>
      {loadout.mainSkill && (
        <div className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Main skill:</span> {loadout.mainSkill}
        </div>
      )}
      {loadout.supports && loadout.supports.length > 0 && (
        <GemList label="Supports" items={loadout.supports} color="text-emerald-300" />
      )}
      <GemList label="Auras" items={loadout.auras} color="text-sky-300" />
      <GemList label="Heralds" items={loadout.heralds} color="text-blue-300" />
      <GemList label="Curses" items={loadout.curses} color="text-fuchsia-300" />
      {loadout.tree?.keystones && loadout.tree.keystones.length > 0 && (
        <GemList label="Keystones" items={loadout.tree.keystones} color="text-amber-300" />
      )}
      {loadout.tree?.notablesAllocated && loadout.tree.notablesAllocated.length > 0 && (
        <GemList
          label="Notables"
          items={loadout.tree.notablesAllocated.slice(0, 8)}
          color="text-amber-300/80"
        />
      )}
      {loadout.gear && loadout.gear.length > 0 && (
        <div className="text-[11px]">
          <span className="font-semibold text-foreground/90">Gear ({loadout.gear.length} slots):</span>{' '}
          <span className="text-muted-foreground">
            {loadout.gear.slice(0, 5).map((g) => g.name).filter(Boolean).join(', ')}
            {loadout.gear.length > 5 ? ` +${loadout.gear.length - 5}` : ''}
          </span>
        </div>
      )}
    </div>
  );
}

export default function PobSummaryCard({ summary, onDismiss }: PobSummaryCardProps) {
  const gearCount = Array.isArray(summary.gear) ? summary.gear.length : 0;
  const altCount = Array.isArray(summary.alternateLoadouts) ? summary.alternateLoadouts.length : 0;

  return (
    <div className="rounded-lg border border-accent/40 bg-accent/5 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-accent">PoB analisado</h3>
            <span className="text-[10px] rounded bg-emerald-950/40 border border-emerald-700/40 px-1.5 py-0.5 text-emerald-300 font-mono uppercase">
              decoded
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {summary.class}
            {summary.ascendancy ? ` (${summary.ascendancy})` : ''} · Level {summary.level}
            {altCount > 0 ? ` · ${altCount} loadout${altCount > 1 ? 's' : ''} alternativo${altCount > 1 ? 's' : ''}` : ''}
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-background/40"
            aria-label="Recolher"
          >
            ✕
          </button>
        )}
      </div>

      {/* Stats line */}
      <div className="flex flex-wrap gap-1.5">
        <Tag label="DPS" value={summary.stats?.totalDps} />
        <Tag label="EHP" value={summary.stats?.ehp} />
        <Tag label="Life" value={summary.stats?.life} />
        <Tag label="ES" value={summary.stats?.energyShield} />
        <Tag label="Res" value={summary.stats?.resists} />
        <Tag label="MS" value={summary.stats?.movementSpeed} />
      </div>

      {/* Active skills */}
      <div className="space-y-1.5 text-[11px]">
        {summary.mainSkill && (
          <div>
            <span className="font-semibold text-foreground">Main skill:</span>{' '}
            <span className="text-muted-foreground">{summary.mainSkill}</span>
          </div>
        )}
        <GemList label="Supports" items={summary.supports} color="text-emerald-300" />
        <GemList label="Auras" items={summary.auras} color="text-sky-300" />
        <GemList label="Heralds" items={summary.heralds} color="text-blue-300" />
        <GemList label="Curses" items={summary.curses} color="text-fuchsia-300" />
        <GemList label="Banners" items={summary.banners} color="text-amber-300" />
        <GemList label="Triggers" items={summary.triggers} color="text-rose-300" />
        <GemList label="Movement" items={summary.movement} color="text-cyan-300" />
      </div>

      {/* Tree snapshot */}
      {summary.tree && (
        <div className="space-y-1 text-[11px]">
          {summary.tree.keystones.length > 0 && (
            <GemList label="Keystones" items={summary.tree.keystones} color="text-amber-300" />
          )}
          {summary.tree.notablesAllocated.length > 0 && (
            <GemList
              label={`Notables (${summary.tree.notablesAllocated.length})`}
              items={summary.tree.notablesAllocated.slice(0, 10)}
              color="text-amber-300/80"
            />
          )}
          {summary.tree.jewels.length > 0 && (
            <GemList label="Jewels" items={summary.tree.jewels} color="text-violet-300" />
          )}
          <div className="text-[10px] text-muted-foreground/70">
            {summary.tree.nodesTotal} nodes alocados
          </div>
        </div>
      )}

      {/* Gear count line */}
      {gearCount > 0 && (
        <div className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Gear:</span>{' '}
          {gearCount} slot{gearCount > 1 ? 's' : ''} decodificado
          {gearCount > 1 ? 's' : ''}
          {summary.gear
            .filter((g) => g.isUnique)
            .slice(0, 3)
            .map((g) => g.name)
            .filter(Boolean)
            .join(', ') && (
            <>
              {' — uniques: '}
              <span className="font-medium text-foreground/90">
                {summary.gear.filter((g) => g.isUnique).map((g) => g.name).filter(Boolean).join(', ')}
              </span>
            </>
          )}
        </div>
      )}

      {/* Alternate loadouts */}
      {altCount > 0 && summary.alternateLoadouts && (
        <div className="space-y-2 border-t border-border/40 pt-3">
          <div className="text-xs font-semibold text-foreground">
            Loadouts alternativos ({altCount})
          </div>
          {summary.alternateLoadouts.map((l) => (
            <LoadoutBlock key={l.id} loadout={l} />
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/70 italic">
        Este snapshot vai pro context do writer como "## BUILD SNAPSHOT" —
        todos os items, passives e auras entram no entityAllowlist.
      </p>
    </div>
  );
}
