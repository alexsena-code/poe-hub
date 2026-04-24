import { describe, it, expect } from "vitest";
import { diffSimulations, ParamChange } from "./simulation-diff";

interface TestWeek {
  weekNumber: number;
  label: string | null;
  defaultActiveBots: number;
  defaultDivinePerHour: number;
  defaultHoursPerDay: number;
  defaultDivinePriceUsd: number | null;
  defaultDivinePriceBrl: number | null;
}

interface TestSim {
  name: string;
  league: string;
  durationWeeks: number;
  startDayOffset: number;
  costConfigName: string | null;
  proxyCostPerBotMonthly: number | null;
  levelingCostPerBot: number | null;
  stashPackCostPerBot: number | null;
  expluginsKeyCostDaily: number | null;
  dpbKeyCostDaily: number | null;
  weeks: TestWeek[];
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function baseWeek(weekNumber = 1): TestWeek {
  return {
    weekNumber,
    label: `Semana ${weekNumber}`,
    defaultActiveBots: 5,
    defaultDivinePerHour: 0.5,
    defaultHoursPerDay: 24,
    defaultDivinePriceUsd: 2.5,
    defaultDivinePriceBrl: 12.0,
  };
}

function makeWeek(weekNumber = 1, overrides: Partial<TestWeek> = {}): TestWeek {
  return { ...baseWeek(weekNumber), ...overrides };
}

function makeSim(
  overrides: Partial<TestSim> = {},
  weeks: TestWeek[] = [makeWeek(1)]
): TestSim {
  return {
    name: "Sim A",
    league: "Settlers",
    durationWeeks: 2,
    startDayOffset: 0,
    costConfigName: "Default",
    proxyCostPerBotMonthly: 10,
    levelingCostPerBot: 5,
    stashPackCostPerBot: 2,
    expluginsKeyCostDaily: 0.5,
    dpbKeyCostDaily: 0.3,
    weeks,
    ...overrides,
  };
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

describe("diffSimulations", () => {
  // ------------------------------------------------------------------
  // Identical simulations
  // ------------------------------------------------------------------
  it("should return empty diff when simulations are identical", () => {
    const simA = makeSim();
    const simB = makeSim();
    const changes = diffSimulations(simA, simB);
    expect(changes).toHaveLength(0);
  });

  it("should return empty diff for identical multi-week simulations", () => {
    const weeks = [makeWeek(1), makeWeek(2), makeWeek(3)];
    const simA = makeSim({}, weeks);
    const simB = makeSim({}, weeks);
    expect(diffSimulations(simA, simB)).toHaveLength(0);
  });

  // ------------------------------------------------------------------
  // Simulation-level field changes
  // ------------------------------------------------------------------
  it("should detect league change", () => {
    const simA = makeSim({ league: "Settlers" });
    const simB = makeSim({ league: "Necropolis" });

    const changes = diffSimulations(simA, simB);
    const leagueChange = changes.find((c) => c.path === "league");

    expect(leagueChange).toBeDefined();
    expect(leagueChange!.valueA).toBe("Settlers");
    expect(leagueChange!.valueB).toBe("Necropolis");
    expect(leagueChange!.label).toBe("Liga");
  });

  it("should detect durationWeeks change", () => {
    const simA = makeSim({ durationWeeks: 4 });
    const simB = makeSim({ durationWeeks: 8 });

    const changes = diffSimulations(simA, simB);
    const change = changes.find((c) => c.path === "durationWeeks");

    expect(change).toBeDefined();
    expect(change!.valueA).toBe(4);
    expect(change!.valueB).toBe(8);
  });

  it("should detect startDayOffset change", () => {
    const simA = makeSim({ startDayOffset: 0 });
    const simB = makeSim({ startDayOffset: 3 });

    const changes = diffSimulations(simA, simB);
    const change = changes.find((c) => c.path === "startDayOffset");

    expect(change).toBeDefined();
    expect(change!.valueA).toBe(0);
    expect(change!.valueB).toBe(3);
  });

  it("should detect costConfigName change", () => {
    const simA = makeSim({ costConfigName: "Config A" });
    const simB = makeSim({ costConfigName: "Config B" });

    const changes = diffSimulations(simA, simB);
    const change = changes.find((c) => c.path === "costConfigName");

    expect(change).toBeDefined();
    expect(change!.label).toBe("Config de custo");
  });

  it("should detect proxyCostPerBotMonthly change", () => {
    const simA = makeSim({ proxyCostPerBotMonthly: 10 });
    const simB = makeSim({ proxyCostPerBotMonthly: 15 });

    const changes = diffSimulations(simA, simB);
    const change = changes.find((c) => c.path === "proxyCostPerBotMonthly");

    expect(change).toBeDefined();
    expect(change!.label).toBe("Proxy/mes");
  });

  it("should detect levelingCostPerBot change", () => {
    const simA = makeSim({ levelingCostPerBot: 5 });
    const simB = makeSim({ levelingCostPerBot: 7 });

    const changes = diffSimulations(simA, simB);
    const change = changes.find((c) => c.path === "levelingCostPerBot");
    expect(change).toBeDefined();
  });

  it("should detect stashPackCostPerBot change", () => {
    const simA = makeSim({ stashPackCostPerBot: 2 });
    const simB = makeSim({ stashPackCostPerBot: 0 });

    const changes = diffSimulations(simA, simB);
    const change = changes.find((c) => c.path === "stashPackCostPerBot");
    expect(change).toBeDefined();
  });

  it("should detect expluginsKeyCostDaily change", () => {
    const simA = makeSim({ expluginsKeyCostDaily: 0.5 });
    const simB = makeSim({ expluginsKeyCostDaily: 1.0 });

    const changes = diffSimulations(simA, simB);
    const change = changes.find((c) => c.path === "expluginsKeyCostDaily");
    expect(change).toBeDefined();
    expect(change!.label).toBe("ExPlugins/dia");
  });

  it("should detect dpbKeyCostDaily change", () => {
    const simA = makeSim({ dpbKeyCostDaily: 0.3 });
    const simB = makeSim({ dpbKeyCostDaily: 0.6 });

    const changes = diffSimulations(simA, simB);
    const change = changes.find((c) => c.path === "dpbKeyCostDaily");
    expect(change).toBeDefined();
    expect(change!.label).toBe("DPB/dia");
  });

  it("should detect multiple simulation-level changes at once", () => {
    const simA = makeSim({ league: "Settlers", durationWeeks: 2 });
    const simB = makeSim({ league: "Necropolis", durationWeeks: 4 });

    const changes = diffSimulations(simA, simB);
    const paths = changes.map((c) => c.path);

    expect(paths).toContain("league");
    expect(paths).toContain("durationWeeks");
  });

  // ------------------------------------------------------------------
  // Week-level default changes
  // ------------------------------------------------------------------
  it("should detect defaultActiveBots change in week 1", () => {
    const simA = makeSim({}, [makeWeek(1)]);
    const simB = makeSim({}, [{ ...makeWeek(1), defaultActiveBots: 10 }]);

    const changes = diffSimulations(simA, simB);
    const change = changes.find((c) => c.path === "week1.defaultActiveBots");

    expect(change).toBeDefined();
    expect(change!.valueA).toBe(5);
    expect(change!.valueB).toBe(10);
    expect(change!.label).toBe("Bots (S1)");
  });

  it("should detect defaultDivinePerHour change in week 2", () => {
    const simA = makeSim({}, [makeWeek(1), makeWeek(2)]);
    const simB = makeSim({}, [
      makeWeek(1),
      { ...makeWeek(2), defaultDivinePerHour: 1.2 },
    ]);

    const changes = diffSimulations(simA, simB);
    const change = changes.find((c) => c.path === "week2.defaultDivinePerHour");

    expect(change).toBeDefined();
    expect(change!.label).toBe("Div/hr (S2)");
    expect(change!.valueA).toBe(0.5);
    expect(change!.valueB).toBe(1.2);
  });

  it("should detect defaultHoursPerDay change", () => {
    const simA = makeSim({}, [makeWeek(1)]);
    const simB = makeSim({}, [{ ...makeWeek(1), defaultHoursPerDay: 16 }]);

    const changes = diffSimulations(simA, simB);
    const change = changes.find((c) => c.path === "week1.defaultHoursPerDay");

    expect(change).toBeDefined();
    expect(change!.label).toBe("Horas/dia (S1)");
  });

  it("should detect defaultDivinePriceUsd change", () => {
    const simA = makeSim({}, [makeWeek(1)]);
    const simB = makeSim({}, [{ ...makeWeek(1), defaultDivinePriceUsd: 5.0 }]);

    const changes = diffSimulations(simA, simB);
    const change = changes.find((c) => c.path === "week1.defaultDivinePriceUsd");

    expect(change).toBeDefined();
    expect(change!.label).toBe("Preco USD (S1)");
  });

  it("should detect defaultDivinePriceBrl change", () => {
    const simA = makeSim({}, [makeWeek(1)]);
    const simB = makeSim({}, [{ ...makeWeek(1), defaultDivinePriceBrl: 25.0 }]);

    const changes = diffSimulations(simA, simB);
    const change = changes.find((c) => c.path === "week1.defaultDivinePriceBrl");

    expect(change).toBeDefined();
    expect(change!.label).toBe("Preco BRL (S1)");
  });

  it("should detect changes across multiple weeks independently", () => {
    const simA = makeSim({}, [makeWeek(1), makeWeek(2)]);
    const simB = makeSim({}, [
      { ...makeWeek(1), defaultActiveBots: 3 },
      { ...makeWeek(2), defaultDivinePerHour: 2.0 },
    ]);

    const changes = diffSimulations(simA, simB);
    const paths = changes.map((c) => c.path);

    expect(paths).toContain("week1.defaultActiveBots");
    expect(paths).toContain("week2.defaultDivinePerHour");
  });

  // ------------------------------------------------------------------
  // Different number of weeks
  // ------------------------------------------------------------------
  it("should flag missing week when simA has more weeks than simB", () => {
    const simA = makeSim({}, [makeWeek(1), makeWeek(2), makeWeek(3)]);
    const simB = makeSim({}, [makeWeek(1), makeWeek(2)]);

    const changes = diffSimulations(simA, simB);
    const change = changes.find((c) => c.path === "week3");

    expect(change).toBeDefined();
    expect(change!.valueA).toBe("existe");
    expect(change!.valueB).toBe("n/a");
    expect(change!.label).toBe("Semana 3");
  });

  it("should flag missing week when simB has more weeks than simA", () => {
    const simA = makeSim({}, [makeWeek(1)]);
    const simB = makeSim({}, [makeWeek(1), makeWeek(2)]);

    const changes = diffSimulations(simA, simB);
    const change = changes.find((c) => c.path === "week2");

    expect(change).toBeDefined();
    expect(change!.valueA).toBe("n/a");
    expect(change!.valueB).toBe("existe");
  });

  it("should handle simA with zero weeks", () => {
    const simA = makeSim({}, []);
    const simB = makeSim({}, [makeWeek(1)]);

    const changes = diffSimulations(simA, simB);
    const change = changes.find((c) => c.path === "week1");

    expect(change).toBeDefined();
    expect(change!.valueA).toBe("n/a");
    expect(change!.valueB).toBe("existe");
  });

  it("should handle simB with zero weeks", () => {
    const simA = makeSim({}, [makeWeek(1)]);
    const simB = makeSim({}, []);

    const changes = diffSimulations(simA, simB);
    const change = changes.find((c) => c.path === "week1");

    expect(change).toBeDefined();
    expect(change!.valueA).toBe("existe");
    expect(change!.valueB).toBe("n/a");
  });

  // ------------------------------------------------------------------
  // Null values
  // ------------------------------------------------------------------
  it("should detect change from null to a value in cost field", () => {
    const simA = makeSim({ costConfigName: null });
    const simB = makeSim({ costConfigName: "Config A" });

    const changes = diffSimulations(simA, simB);
    const change = changes.find((c) => c.path === "costConfigName");

    expect(change).toBeDefined();
    expect(change!.valueA).toBeNull();
    expect(change!.valueB).toBe("Config A");
  });

  it("should detect change from a value to null in cost field", () => {
    const simA = makeSim({ proxyCostPerBotMonthly: 10 });
    const simB = makeSim({ proxyCostPerBotMonthly: null });

    const changes = diffSimulations(simA, simB);
    const change = changes.find((c) => c.path === "proxyCostPerBotMonthly");

    expect(change).toBeDefined();
    expect(change!.valueA).toBe(10);
    expect(change!.valueB).toBeNull();
  });

  it("should not flag null-to-null as a change", () => {
    const simA = makeSim({ costConfigName: null, proxyCostPerBotMonthly: null });
    const simB = makeSim({ costConfigName: null, proxyCostPerBotMonthly: null });

    const changes = diffSimulations(simA, simB);
    const costNameChange = changes.find((c) => c.path === "costConfigName");
    const proxyChange = changes.find((c) => c.path === "proxyCostPerBotMonthly");

    expect(costNameChange).toBeUndefined();
    expect(proxyChange).toBeUndefined();
  });

  it("should detect null-to-null for week price fields as equal (no change)", () => {
    const weekA = { ...makeWeek(1), defaultDivinePriceUsd: null, defaultDivinePriceBrl: null };
    const weekB = { ...makeWeek(1), defaultDivinePriceUsd: null, defaultDivinePriceBrl: null };

    const simA = makeSim({}, [weekA]);
    const simB = makeSim({}, [weekB]);

    const changes = diffSimulations(simA, simB);
    expect(changes).toHaveLength(0);
  });

  it("should detect change from null to number in week price field", () => {
    const weekA = { ...makeWeek(1), defaultDivinePriceBrl: null };
    const weekB = { ...makeWeek(1), defaultDivinePriceBrl: 15.0 };

    const simA = makeSim({}, [weekA]);
    const simB = makeSim({}, [weekB]);

    const changes = diffSimulations(simA, simB);
    const change = changes.find((c) => c.path === "week1.defaultDivinePriceBrl");

    expect(change).toBeDefined();
    expect(change!.valueA).toBeNull();
    expect(change!.valueB).toBe(15.0);
  });

  // ------------------------------------------------------------------
  // Return type shape
  // ------------------------------------------------------------------
  it("should return ParamChange objects with all required fields", () => {
    const simA = makeSim({ league: "Settlers" });
    const simB = makeSim({ league: "Necropolis" });

    const changes = diffSimulations(simA, simB);
    expect(changes.length).toBeGreaterThan(0);

    for (const change of changes) {
      expect(change).toHaveProperty("path");
      expect(change).toHaveProperty("label");
      expect(change).toHaveProperty("valueA");
      expect(change).toHaveProperty("valueB");
    }
  });

  it("should not include unchanged fields in the result", () => {
    const simA = makeSim({ league: "Settlers", durationWeeks: 4 });
    const simB = makeSim({ league: "Necropolis", durationWeeks: 4 });

    const changes = diffSimulations(simA, simB);
    const durationChange = changes.find((c) => c.path === "durationWeeks");

    // durationWeeks is the same → should NOT appear
    expect(durationChange).toBeUndefined();
  });
});
