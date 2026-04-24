"use client";

import { useState, type CSSProperties } from "react";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Info,
  Search,
  TrendingUp,
  XCircle,
  Plus,
  FileX,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Mock dataset — spiky intentionally so the smooth vs linear contrast
// is visible. Real charts use the same shape from /api/engine endpoints.
const CHART_SAMPLE = [
  { day: "Mon", value: 12 },
  { day: "Tue", value: 38 },
  { day: "Wed", value: 15 },
  { day: "Thu", value: 47 },
  { day: "Fri", value: 22 },
  { day: "Sat", value: 41 },
  { day: "Sun", value: 18 },
];

// ─── Theme variants ────────────────────────────────────────────────
// HSL triples applied as CSS vars on a wrapper div so Tailwind utilities
// pick up scoped overrides. Zinc = current production theme; Slate is
// cooler + ops-feeling; Neutral is plainer than Zinc.

type PaletteKey = "zinc" | "slate" | "neutral";

const PALETTES: Record<PaletteKey, { label: string; vars: Record<string, string> }> = {
  zinc: {
    label: "Zinc (atual)",
    vars: {
      "--background": "240 10% 3.9%",
      "--foreground": "0 0% 98%",
      "--card": "240 10% 3.9%",
      "--card-foreground": "0 0% 98%",
      "--muted": "240 3.7% 15.9%",
      "--muted-foreground": "240 5% 64.9%",
      "--border": "240 3.7% 15.9%",
      "--primary": "0 0% 98%",
      "--primary-foreground": "240 5.9% 10%",
    },
  },
  slate: {
    label: "Slate (proposto)",
    vars: {
      "--background": "222.2 84% 4.9%",
      "--foreground": "210 40% 98%",
      "--card": "222.2 84% 4.9%",
      "--card-foreground": "210 40% 98%",
      "--muted": "217.2 32.6% 17.5%",
      "--muted-foreground": "215 20.2% 65.1%",
      "--border": "217.2 32.6% 17.5%",
      "--primary": "210 40% 98%",
      "--primary-foreground": "222.2 47.4% 11.2%",
    },
  },
  neutral: {
    label: "Neutral",
    vars: {
      "--background": "0 0% 3.9%",
      "--foreground": "0 0% 98%",
      "--card": "0 0% 3.9%",
      "--card-foreground": "0 0% 98%",
      "--muted": "0 0% 14.9%",
      "--muted-foreground": "0 0% 63.9%",
      "--border": "0 0% 14.9%",
      "--primary": "0 0% 98%",
      "--primary-foreground": "0 0% 9%",
    },
  },
};

// Semantic + accent colors proposed for the theme. Used in swatches +
// in the mockup at the bottom of this page. Will become real --color-*
// tokens in globals.css if the operator approves Phase 1.
const PROPOSED_COLORS = {
  success: { hsl: "142 76% 36%", hex: "#16a34a", label: "Success" },
  warning: { hsl: "38 92% 50%", hex: "#f59e0b", label: "Warning" },
  info: { hsl: "217 91% 60%", hex: "#3b82f6", label: "Info" },
  destructive: { hsl: "0 72% 51%", hex: "#dc2626", label: "Destructive" },
  seoAccent: { hsl: "160 84% 39%", hex: "#10b981", label: "SEO accent (emerald)" },
};

// ─── Page ──────────────────────────────────────────────────────────

export default function DesignPreviewPage() {
  const [palette, setPalette] = useState<PaletteKey>("slate");
  const paletteStyle = PALETTES[palette].vars as CSSProperties;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Design Preview"
        description="Propostas de style da session 01. Phase 1 (neutral + semantic colors + typography vars + charts lineares) ja esta LIVE — o resto ainda e scoped/preview."
      />

      {/* Status banner: Phase 1 applied */}
      <div
        className="rounded-lg border border-success/30 bg-success/10 px-4 py-3"
        role="status"
      >
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span className="font-medium text-success">Phase 1 aplicada</span>
          <span className="text-muted-foreground">
            · zinc → neutral · semantic colors (success/warning/info/destructive) ·
            typography CSS vars · charts com type="linear"
          </span>
        </div>
      </div>

      {/* === Section H: Typography scale ============================ */}
      <Section
        title="H. Typography scale"
        subtitle="Atual (manual por pagina) vs 6-level scale proposto"
      >
        <Row>
          <Column heading="Atual">
            <h1 className="text-3xl font-bold">Titulo da pagina (3xl)</h1>
            <h2 className="text-2xl font-bold">Subtitulo (2xl)</h2>
            <h3 className="text-xl font-bold">Secao (xl)</h3>
            <p className="text-sm">Texto padrao (sm)</p>
            <p className="text-xs text-muted-foreground">Caption (xs)</p>
            <p className="mt-2 text-xs text-muted-foreground italic">
              Sem hierarquia garantida — cada pagina escolhe tamanhos sozinha
              (hardware usa 2xl, workspace usa 3xl, etc).
            </p>
          </Column>
          <Column heading="Proposto (6 levels via CSS var)">
            <div className="text-[30px] font-bold leading-tight tracking-tight">H1 · 30px · bold</div>
            <div className="text-[24px] font-semibold leading-tight">H2 · 24px · semibold</div>
            <div className="text-[20px] font-semibold">H3 · 20px · semibold</div>
            <div className="text-[18px] font-medium">H4 · 18px · medium</div>
            <div className="text-[14px]">Body · 14px · normal</div>
            <div className="text-[12px] text-muted-foreground">Caption · 12px · muted</div>
          </Column>
        </Row>
      </Section>

      {/* === Section C: Palette swap ================================= */}
      <Section
        title="C. Palette swap (zinc → slate)"
        subtitle="Escolha uma variante pra pre-visualizar todo o preview abaixo"
      >
        <div className="mb-4 flex gap-2">
          {(Object.keys(PALETTES) as PaletteKey[]).map((key) => (
            <Button
              key={key}
              variant={palette === key ? "default" : "outline"}
              size="sm"
              onClick={() => setPalette(key)}
            >
              {PALETTES[key].label}
            </Button>
          ))}
        </div>
        <div
          style={paletteStyle}
          className="rounded-lg border border-border bg-background p-6"
        >
          <div className="mb-3 text-xs uppercase text-muted-foreground">
            Amostra com a paleta "{PALETTES[palette].label}"
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Swatch name="background" hslVar="--background" />
            <Swatch name="muted" hslVar="--muted" />
            <Swatch name="border" hslVar="--border" />
          </div>
          <div className="mt-4 rounded-md bg-card p-4">
            <h3 className="text-lg font-semibold text-foreground">Card no novo tom</h3>
            <p className="text-sm text-muted-foreground">
              Slate e mais frio/azulado — vibe de noite-ops. Neutral e
              mais neutro que zinc. Zinc e o atual.
            </p>
          </div>
        </div>
      </Section>

      {/* === Section B: Semantic colors ============================== */}
      <Section
        title="B. Semantic colors (success/warning/info)"
        subtitle="Status badges com cores do theme em vez de tailwind hardcoded"
      >
        <Row>
          <Column heading="Atual (hardcoded — bot-status-badge.tsx)">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-md bg-green-900 px-2 py-1 text-xs font-medium text-green-300">
                Ativo
              </span>
              <span className="inline-flex items-center rounded-md bg-yellow-900 px-2 py-1 text-xs font-medium text-yellow-300">
                Pausado
              </span>
              <span className="inline-flex items-center rounded-md bg-red-900 px-2 py-1 text-xs font-medium text-red-300">
                Erro
              </span>
              <span className="inline-flex items-center rounded-md bg-blue-900 px-2 py-1 text-xs font-medium text-blue-300">
                Syncing
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground italic">
              Bypassa o theme. Nao reage a palette swap.
            </p>
          </Column>
          <Column heading="Proposto (--color-success etc.)">
            <div className="flex flex-wrap gap-2">
              <SemanticBadge color={PROPOSED_COLORS.success} icon={CheckCircle2} label="Ativo" />
              <SemanticBadge color={PROPOSED_COLORS.warning} icon={AlertCircle} label="Pausado" />
              <SemanticBadge color={PROPOSED_COLORS.destructive} icon={XCircle} label="Erro" />
              <SemanticBadge color={PROPOSED_COLORS.info} icon={Info} label="Syncing" />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
              {Object.entries(PROPOSED_COLORS).slice(0, 4).map(([key, c]) => (
                <div key={key} className="flex flex-col gap-1">
                  <div
                    className="h-10 rounded"
                    style={{ backgroundColor: c.hex }}
                  />
                  <div className="font-mono text-[10px] text-muted-foreground">{c.hex}</div>
                </div>
              ))}
            </div>
          </Column>
        </Row>
      </Section>

      {/* === Section A: PageHeader =================================== */}
      <Section
        title="A. PageHeader component"
        subtitle="Atual (h1 manual repetido em 40+ pages) vs <PageHeader /> compartilhado"
      >
        <Row>
          <Column heading="Atual (inline em cada page)">
            <div className="rounded-md border border-border p-4">
              <h1 className="text-3xl font-bold">Bots</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gerencie seus bots de farming
              </p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground italic">
              Tamanhos variam: 3xl em workspace, 2xl em hardware. Sem
              actions slot.
            </p>
          </Column>
          <Column heading="Proposto (<PageHeader />)">
            <div className="rounded-md border border-border p-4">
              <PageHeader
                title="Bots"
                description="Gerencie seus bots de farming"
                actions={
                  <Button size="sm">
                    <Plus className="h-4 w-4" />
                    Novo bot
                  </Button>
                }
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground italic">
              Centraliza tracking-tight, slot de actions, description
              opcional. Uma mudanca futura de tipografia reflete em 40 pages.
            </p>
          </Column>
        </Row>
      </Section>

      {/* === Section F: SEO accent =================================== */}
      <Section
        title="F. SEO domain accent (emerald)"
        subtitle="Diferencia research/analysis/opportunities dos farm/admin genericos"
      >
        <Row>
          <Column heading="Atual (mesmo foreground de todas pages)">
            <div className="rounded-md border border-border p-4">
              <h2 className="text-xl font-bold">SEO Research</h2>
              <p className="text-sm text-muted-foreground">
                Keyword discovery, suggest expansion, trending terms
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm">Run discovery</Button>
                <Button size="sm" variant="outline">Export</Button>
              </div>
            </div>
          </Column>
          <Column heading="Proposto (accent emerald nos headers SEO)">
            <div
              className="rounded-md border p-4"
              style={{ borderColor: PROPOSED_COLORS.seoAccent.hex + "40" }}
            >
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4" style={{ color: PROPOSED_COLORS.seoAccent.hex }} />
                <h2
                  className="text-xl font-bold"
                  style={{ color: PROPOSED_COLORS.seoAccent.hex }}
                >
                  SEO Research
                </h2>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Keyword discovery, suggest expansion, trending terms
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  style={{
                    backgroundColor: PROPOSED_COLORS.seoAccent.hex,
                    color: "white",
                  }}
                >
                  Run discovery
                </Button>
                <Button size="sm" variant="outline">Export</Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground italic">
              Accent aplicado a breadcrumbs + primary CTAs + section
              icons. Dark emerald ({PROPOSED_COLORS.seoAccent.hex}) lê bem no theme
              atual sem competir com o red/blue dos charts.
            </p>
          </Column>
        </Row>
      </Section>

      {/* === Section D: EmptyState =================================== */}
      <Section
        title="D. EmptyState component"
        subtitle="Improvisado inline em 15+ pages vs <EmptyState /> compartilhado"
      >
        <Row>
          <Column heading="Atual (inline Card)">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum bot encontrado
              </CardContent>
            </Card>
            <p className="mt-2 text-xs text-muted-foreground italic">
              Cada list page inventa o próprio empty state. Sem icon,
              sem CTA, sem description.
            </p>
          </Column>
          <Column heading="Proposto (<EmptyState />)">
            <EmptyState
              icon={Bot}
              title="Nenhum bot cadastrado"
              description="Bots coletam divines, chaos e itens via farmas automaticas. Crie o primeiro pra comecar a trackear vendas."
              action={
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  Criar primeiro bot
                </Button>
              }
            />
            <p className="mt-2 text-xs text-muted-foreground italic">
              Icon + title + description + action slot. Uma UX
              consistente pra todas as list pages vazias.
            </p>
          </Column>
        </Row>
      </Section>

      {/* === Section: Chart smoothing (APPLIED) ====================== */}
      <Section
        title="Charts: smooth (monotone) → linear [aplicado]"
        subtitle="3 charts no codebase trocaram de type='monotone' pra type='linear' — sem suavizacao de curva"
      >
        <Row>
          <Column heading="Antes (monotone / smooth)">
            <div className="rounded-md border border-border p-3">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={CHART_SAMPLE}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="day"
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                  />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-chart-2)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground italic">
              Curva suavizada — interpola pontos com splines, pode dar
              falsa sensacao de tendencia entre medicoes.
            </p>
          </Column>
          <Column heading="Depois (linear / sem smoothing)">
            <div className="rounded-md border border-border p-3">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={CHART_SAMPLE}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="day"
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                  />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="linear"
                    dataKey="value"
                    stroke="var(--color-chart-3)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground italic">
              Retas entre pontos — reflete os dados reais sem interpolacao.
              Aplicado nos 3 charts: llm-logs, hardware analytics (2 spots).
            </p>
          </Column>
        </Row>
      </Section>

      {/* === Full mockup combining everything ======================= */}
      <Section
        title="Mini mockup combinando tudo"
        subtitle="Pagina fake de /seo/research renderizada com Phase 1 + Phase 2 aplicadas"
      >
        <div
          style={paletteStyle}
          className="rounded-lg border border-border bg-background p-6 space-y-5"
        >
          <PageHeader
            title="SEO Research"
            description="Keyword discovery, trending terms, competitor gaps"
            actions={
              <>
                <Button size="sm" variant="outline">Export CSV</Button>
                <Button
                  size="sm"
                  style={{
                    backgroundColor: PROPOSED_COLORS.seoAccent.hex,
                    color: "white",
                  }}
                >
                  <Search className="h-4 w-4" />
                  Run discovery
                </Button>
              </>
            }
          />
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard
              icon={TrendingUp}
              label="Keywords tracked"
              value="628"
              accent={PROPOSED_COLORS.seoAccent.hex}
            />
            <StatCard
              icon={CheckCircle2}
              label="Opportunities open"
              value="42"
              accent={PROPOSED_COLORS.success.hex}
            />
            <StatCard
              icon={AlertCircle}
              label="Striking distance"
              value="17"
              accent={PROPOSED_COLORS.warning.hex}
            />
          </div>
          <EmptyState
            icon={FileX}
            title="Nenhuma analise recente"
            description="Rode um discovery pra popular a tabela com keywords e scores VICE."
            action={
              <Button
                size="sm"
                style={{
                  backgroundColor: PROPOSED_COLORS.seoAccent.hex,
                  color: "white",
                }}
              >
                Run discovery agora
              </Button>
            }
          />
        </div>
      </Section>
    </div>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function Column({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {heading}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Swatch({ name, hslVar }: { name: string; hslVar: string }) {
  return (
    <div className="rounded border border-border p-3">
      <div
        className="h-8 rounded mb-2"
        style={{ backgroundColor: `hsl(var(${hslVar}))` }}
      />
      <div className="text-xs font-mono text-muted-foreground">{name}</div>
    </div>
  );
}

function SemanticBadge({
  color,
  icon: Icon,
  label,
}: {
  color: { hex: string };
  icon: typeof CheckCircle2;
  label: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium"
      style={{
        backgroundColor: color.hex + "20",
        color: color.hex,
      }}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4" style={{ color: accent }} />
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
