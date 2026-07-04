import { describe, it, expect } from "vitest";
import {
  normalizeRemoteMetrics,
  seriesKey,
  METRIC_NAME_RE,
  MAX_SERIES_PER_EXECUTOR,
} from "./cx-metrics-remote";

const EXEC = "DESKTOP-ABC-cx";
const LEAGUE = "Mercenaries";

describe("METRIC_NAME_RE", () => {
  it("aceita nomes prom-safe minúsculos", () => {
    expect(METRIC_NAME_RE.test("cx_bridge_commands_total")).toBe(true);
    expect(METRIC_NAME_RE.test("_private")).toBe(true);
    expect(METRIC_NAME_RE.test("cx_slots_open")).toBe(true);
  });

  it("rejeita maiúsculas, dígito inicial e caracteres especiais", () => {
    expect(METRIC_NAME_RE.test("CxSlots")).toBe(false);
    expect(METRIC_NAME_RE.test("1cx_total")).toBe(false);
    expect(METRIC_NAME_RE.test("cx-slots")).toBe(false);
    expect(METRIC_NAME_RE.test("cx slots")).toBe(false);
    expect(METRIC_NAME_RE.test("")).toBe(false);
  });
});

describe("normalizeRemoteMetrics", () => {
  it("mapeia counters e gauges com labels extras {executor_id, league}", () => {
    const known = new Set<string>();
    const res = normalizeRemoteMetrics(
      {
        counters: [
          { name: "cx_bridge_commands_total", labels: { cmd: "place", status: "ok" }, value: 42 },
        ],
        gauges: [{ name: "cx_slots_open", value: 7 }],
      },
      EXEC,
      LEAGUE,
      known
    );

    expect(res.droppedInvalid).toBe(0);
    expect(res.droppedOverCap).toBe(0);
    expect(res.accepted).toHaveLength(2);

    const counter = res.accepted[0];
    expect(counter.kind).toBe("counter");
    expect(counter.name).toBe("cx_bridge_commands_total");
    expect(counter.value).toBe(42);
    expect(counter.labels).toEqual({
      cmd: "place",
      status: "ok",
      executor_id: EXEC,
      league: LEAGUE,
    });

    const gauge = res.accepted[1];
    expect(gauge.kind).toBe("gauge");
    expect(gauge.labels).toEqual({ executor_id: EXEC, league: LEAGUE });
  });

  it("league null vira label vazia", () => {
    const res = normalizeRemoteMetrics(
      { gauges: [{ name: "cx_inventory_pct", value: 55 }] },
      EXEC,
      null,
      new Set()
    );
    expect(res.accepted[0].labels.league).toBe("");
  });

  it("rejeita nome inválido de métrica", () => {
    const res = normalizeRemoteMetrics(
      {
        counters: [
          { name: "Cx_Bad_Total", value: 1 },
          { name: "9starts_with_digit", value: 1 },
          { name: "has-dash_total", value: 1 },
        ],
        gauges: [{ name: "cx_ok", value: 2 }],
      },
      EXEC,
      LEAGUE,
      new Set()
    );
    expect(res.droppedInvalid).toBe(3);
    expect(res.accepted).toHaveLength(1);
    expect(res.accepted[0].name).toBe("cx_ok");
  });

  it("rejeita valor não numérico, labels inválidas e sample malformado", () => {
    const res = normalizeRemoteMetrics(
      {
        counters: [
          { name: "cx_a_total", value: "abc" }, // valor não numérico
          { name: "cx_b_total" }, // sem value
          { name: "cx_c_total", value: 1, labels: { "bad-label": "x" } }, // label inválida
          { name: "cx_d_total", value: 1, labels: "not-an-object" }, // labels malformadas
          null, // sample nulo
        ],
      },
      EXEC,
      LEAGUE,
      new Set()
    );
    expect(res.accepted).toHaveLength(0);
    expect(res.droppedInvalid).toBe(5);
  });

  it("executor não sobrescreve executor_id/league", () => {
    const res = normalizeRemoteMetrics(
      {
        gauges: [
          { name: "cx_spoof", value: 1, labels: { executor_id: "outro", league: "Fake" } },
        ],
      },
      EXEC,
      LEAGUE,
      new Set()
    );
    expect(res.accepted[0].labels).toEqual({ executor_id: EXEC, league: LEAGUE });
  });

  it("aplica o cap de séries por executor e descarta o excedente", () => {
    const known = new Set<string>();
    const gauges = Array.from({ length: MAX_SERIES_PER_EXECUTOR + 10 }, (_, i) => ({
      name: "cx_many",
      labels: { idx: String(i) },
      value: i,
    }));
    const res = normalizeRemoteMetrics({ gauges }, EXEC, LEAGUE, known);

    expect(res.accepted).toHaveLength(MAX_SERIES_PER_EXECUTOR);
    expect(res.droppedOverCap).toBe(10);
    expect(known.size).toBe(MAX_SERIES_PER_EXECUTOR);
  });

  it("série já conhecida continua atualizável mesmo com o cap cheio", () => {
    const known = new Set<string>();
    // enche o cap
    normalizeRemoteMetrics(
      {
        gauges: Array.from({ length: MAX_SERIES_PER_EXECUTOR }, (_, i) => ({
          name: "cx_many",
          labels: { idx: String(i) },
          value: i,
        })),
      },
      EXEC,
      LEAGUE,
      known
    );

    // atualização de série existente passa; série nova é descartada
    const res = normalizeRemoteMetrics(
      {
        gauges: [
          { name: "cx_many", labels: { idx: "0" }, value: 999 }, // conhecida
          { name: "cx_many", labels: { idx: "novo" }, value: 1 }, // nova (over cap)
        ],
      },
      EXEC,
      LEAGUE,
      known
    );
    expect(res.accepted).toHaveLength(1);
    expect(res.accepted[0].value).toBe(999);
    expect(res.droppedOverCap).toBe(1);
  });

  it("cap é por executor: conjuntos de séries independentes", () => {
    const knownA = new Set<string>();
    const knownB = new Set<string>();
    const gauges = Array.from({ length: MAX_SERIES_PER_EXECUTOR }, (_, i) => ({
      name: "cx_many",
      labels: { idx: String(i) },
      value: i,
    }));

    const resA = normalizeRemoteMetrics({ gauges }, "exec-a", LEAGUE, knownA);
    const resB = normalizeRemoteMetrics({ gauges }, "exec-b", LEAGUE, knownB);
    expect(resA.droppedOverCap).toBe(0);
    expect(resB.droppedOverCap).toBe(0);
  });

  it("payload sem listas ou com listas não-array não explode", () => {
    expect(normalizeRemoteMetrics({}, EXEC, LEAGUE, new Set()).accepted).toHaveLength(0);
    const res = normalizeRemoteMetrics(
      { counters: "oops", gauges: 5 },
      EXEC,
      LEAGUE,
      new Set()
    );
    expect(res.accepted).toHaveLength(0);
    expect(res.droppedInvalid).toBe(2);
  });
});

describe("seriesKey", () => {
  it("é estável independente da ordem das labels", () => {
    expect(seriesKey("m", { a: "1", b: "2" })).toBe(seriesKey("m", { b: "2", a: "1" }));
  });

  it("distingue séries com labels diferentes", () => {
    expect(seriesKey("m", { a: "1" })).not.toBe(seriesKey("m", { a: "2" }));
  });
});
