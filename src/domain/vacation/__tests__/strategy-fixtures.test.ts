import { describe, expect, it } from "vitest";
import { FIXTURE_ORIGIN, MONDAY, findDayOfWeek, holiday, makeScenario } from "./fixtures";
import { addDays, differenceInDays } from "../models/local-date";
import { createVacationEngine } from "../engine";
import { debugPortfolio } from "../utils/debug";
import { STRATEGY_RULES } from "../scoring/scoring-config";
import { VacationStrategy, type VacationPortfolio } from "../models/vacation-plan";

const SHOW_OUTPUT = process.env.VACATION_DEBUG === "1";

const MONDAY_ANCHOR = findDayOfWeek(addDays(FIXTURE_ORIGIN, 7), MONDAY);

/**
 * Fixture A — 장기 집중에 유리.
 * 화·수·목이 연달아 공휴일이라 월+금 2일만 쓰면 9일이 통째로 열린다.
 */
function fixtureA(annualLeaveDays = 8) {
  return makeScenario({
    days: 200,
    annualLeaveDays,
    holidays: [
      holiday(addDays(MONDAY_ANCHOR, 1), "황금연휴 1"),
      holiday(addDays(MONDAY_ANCHOR, 2), "황금연휴 2"),
      holiday(addDays(MONDAY_ANCHOR, 3), "황금연휴 3"),
    ],
  });
}

/**
 * Fixture B — 연차 절약에 유리.
 * 주말에 딱 붙은 단일 공휴일만 여럿. 연차 1일로 4일을 만드는 고효율 후보가 많다.
 */
function fixtureB(annualLeaveDays = 8) {
  return makeScenario({
    days: 200,
    annualLeaveDays,
    holidays: [
      holiday(addDays(MONDAY_ANCHOR, 0), "월요일 공휴일 A"),
      holiday(addDays(MONDAY_ANCHOR, 32), "금요일 공휴일 B"),
      holiday(addDays(MONDAY_ANCHOR, 63), "월요일 공휴일 C"),
      holiday(addDays(MONDAY_ANCHOR, 95), "금요일 공휴일 D"),
      holiday(addDays(MONDAY_ANCHOR, 126), "월요일 공휴일 E"),
    ],
  });
}

/**
 * Fixture C — 수시 휴가 분산에 유리.
 * 비슷한 크기의 기회가 여러 달에 고르게 흩어져 있다.
 */
function fixtureC(annualLeaveDays = 8) {
  return makeScenario({
    days: 250,
    annualLeaveDays,
    holidays: Array.from({ length: 8 }, (_, i) =>
      holiday(addDays(MONDAY_ANCHOR, i * 28), `분산 공휴일 ${i + 1}`),
    ),
  });
}

function runAllStrategies(scenario: ReturnType<typeof makeScenario>) {
  const engine = createVacationEngine();
  const byStrategy = new Map<VacationStrategy, VacationPortfolio>();
  for (const strategy of [
    VacationStrategy.LongBreak,
    VacationStrategy.FrequentBreaks,
    VacationStrategy.LeaveSaving,
  ]) {
    byStrategy.set(strategy, engine.optimize({ ...scenario.input, strategy }).portfolio);
  }
  return byStrategy;
}

function longestBlock(portfolio: VacationPortfolio): number {
  if (portfolio.selectedCandidates.length === 0) return 0;
  return Math.max(...portfolio.selectedCandidates.map((c) => c.consecutiveFullRestDays));
}

function report(name: string, byStrategy: Map<VacationStrategy, VacationPortfolio>) {
  if (!SHOW_OUTPUT) return;
  console.log(`\n===== ${name} =====`);
  for (const [strategy, portfolio] of byStrategy) {
    console.log(`\n--- ${strategy} ---`);
    console.log(debugPortfolio(portfolio));
  }
}

describe("Fixture A: 장기 집중에 유리한 달력", () => {
  const byStrategy = runAllStrategies(fixtureA());

  it("세 전략이 서로 다른 조합을 만든다", () => {
    report("Fixture A", byStrategy);
    const signatures = [...byStrategy.values()].map((portfolio) =>
      portfolio.selectedCandidates.map((c) => `${c.startDate}~${c.endDate}`).join("|"),
    );
    expect(new Set(signatures).size).toBe(3);
  });

  it("장기 집중이 가장 긴 단일 휴가를 만든다", () => {
    const long = byStrategy.get(VacationStrategy.LongBreak)!;
    const frequent = byStrategy.get(VacationStrategy.FrequentBreaks)!;
    const saving = byStrategy.get(VacationStrategy.LeaveSaving)!;

    expect(longestBlock(long)).toBeGreaterThanOrEqual(9);
    expect(longestBlock(long)).toBeGreaterThan(longestBlock(frequent));
    expect(longestBlock(long)).toBeGreaterThan(longestBlock(saving));
    expect(long.selectedCandidates.length).toBeLessThanOrEqual(2);
  });
});

describe("Fixture B: 연차 절약에 유리한 달력", () => {
  const byStrategy = runAllStrategies(fixtureB());

  it("세 전략이 서로 다른 조합을 만든다", () => {
    report("Fixture B", byStrategy);
    const signatures = [...byStrategy.values()].map((portfolio) =>
      portfolio.selectedCandidates.map((c) => `${c.startDate}~${c.endDate}`).join("|"),
    );
    expect(new Set(signatures).size).toBe(3);
  });

  it("연차 절약이 가장 적은 연차로 가장 높은 효율을 낸다", () => {
    const long = byStrategy.get(VacationStrategy.LongBreak)!;
    const saving = byStrategy.get(VacationStrategy.LeaveSaving)!;

    expect(saving.totalAnnualLeaveMinutesUsed).toBeLessThan(long.totalAnnualLeaveMinutesUsed);
    expect(saving.portfolioEfficiency).toBeGreaterThan(long.portfolioEfficiency);
    // 연차 1일로 4일을 쉬는 구조가 있으므로 효율 4 근처가 나와야 한다.
    expect(saving.portfolioEfficiency).toBeGreaterThanOrEqual(3.5);
  });
});

describe("Fixture C: 수시 휴가 분산에 유리한 달력", () => {
  const byStrategy = runAllStrategies(fixtureC());

  it("세 전략이 서로 다른 조합을 만든다", () => {
    report("Fixture C", byStrategy);
    const signatures = [...byStrategy.values()].map((portfolio) =>
      portfolio.selectedCandidates.map((c) => `${c.startDate}~${c.endDate}`).join("|"),
    );
    expect(new Set(signatures).size).toBe(3);
  });

  it("수시 휴가가 가장 많은 횟수로, 충분한 간격을 두고 나눠 쉰다", () => {
    const long = byStrategy.get(VacationStrategy.LongBreak)!;
    const frequent = byStrategy.get(VacationStrategy.FrequentBreaks)!;

    expect(frequent.selectedCandidates.length).toBeGreaterThan(long.selectedCandidates.length);
    expect(frequent.selectedCandidates.length).toBeGreaterThanOrEqual(3);

    // "한 달에 하나"가 아니라 "최소 간격"으로 분산을 보장한다.
    // 달 경계에 붙어버리는 1/31 + 2/1 조합을 막으려면 간격 기준이 더 정확하다.
    const minGapDays = STRATEGY_RULES[VacationStrategy.FrequentBreaks].minGapDaysBetweenCandidates;
    const sorted = [...frequent.selectedCandidates].sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    );
    for (let i = 1; i < sorted.length; i++) {
      const gap = differenceInDays(sorted[i - 1].endDate, sorted[i].startDate);
      expect(gap).toBeGreaterThan(minGapDays);
    }

    // 그리고 실제로 여러 달에 걸쳐 흩어져야 한다.
    const months = new Set(sorted.map((c) => c.startDate.slice(0, 7)));
    expect(months.size).toBeGreaterThanOrEqual(3);
  });
});

describe("§63: 옵션만 바꿔도 실제 추천이 달라진다", () => {
  it("모든 fixture에서 세 전략의 연차 사용/휴식 구성이 구분된다", () => {
    for (const [name, scenario] of [
      ["A", fixtureA()],
      ["B", fixtureB()],
      ["C", fixtureC()],
    ] as const) {
      const byStrategy = runAllStrategies(scenario);
      const profiles = [...byStrategy.values()].map((portfolio) =>
        [
          portfolio.selectedCandidates.length,
          portfolio.totalAnnualLeaveMinutesUsed,
          longestBlock(portfolio),
        ].join(","),
      );
      // 이름만 다른 같은 추천이 아니라, 구성 자체가 달라야 한다.
      expect(new Set(profiles).size, `fixture ${name}: ${profiles.join(" / ")}`).toBe(3);
    }
  });
});
