import { describe, expect, it } from "vitest";
import {
  FIXTURE_ORIGIN,
  MONDAY,
  STANDARD_DAILY_MINUTES,
  findDayOfWeek,
  holiday,
  makeScenario,
} from "./fixtures";
import { addDays, differenceInDays } from "../models/local-date";
import { createVacationEngine } from "../engine";
import { STRATEGY_RULES } from "../scoring/scoring-config";
import { hasCandidateOverlap } from "../models/vacation-candidate";
import { VacationStrategy, type VacationEngineInput } from "../models/vacation-plan";

function runStrategy(input: VacationEngineInput, strategy: VacationStrategy) {
  const engine = createVacationEngine();
  return engine.optimize({ ...input, strategy });
}

/**
 * 여러 달에 걸쳐 공휴일이 흩어져 있는 달력.
 * 장기 집중 / 수시 휴가 / 연차 절약이 서로 다른 답을 내야 하는 상황을 만든다.
 */
function makeSpreadScenario(annualLeaveDays: number) {
  const monday = findDayOfWeek(addDays(FIXTURE_ORIGIN, 7), MONDAY);
  return makeScenario({
    days: 200,
    annualLeaveDays,
    holidays: [
      // 1) 화·수·목이 연달아 공휴일 → 월+금 2일로 9일을 만드는 대형 연휴
      holiday(addDays(monday, 1), "연휴 A-1"),
      holiday(addDays(monday, 2), "연휴 A-2"),
      holiday(addDays(monday, 3), "연휴 A-3"),
      // 2) 약 2개월 뒤 월요일 단일 공휴일 → 금요일 1일로 4일
      holiday(addDays(monday, 63), "연휴 B"),
      // 3) 약 4개월 뒤 금요일 단일 공휴일 → 목요일 1일로 4일
      holiday(addDays(monday, 123), "연휴 C"),
    ],
  });
}

describe("TEST 10: 연차 부족", () => {
  it("좋은 후보라도 잔여 연차를 넘으면 포트폴리오에 들어가지 않는다", () => {
    const { input } = makeSpreadScenario(1);
    const result = runStrategy(input, VacationStrategy.LongBreak);

    expect(result.portfolio.selectedCandidates.length).toBeGreaterThan(0);
    expect(result.summary.leaveMinutesUsed).toBeLessThanOrEqual(STANDARD_DAILY_MINUTES);
    for (const candidate of result.portfolio.selectedCandidates) {
      expect(candidate.totalLeaveMinutesUsed).toBeLessThanOrEqual(STANDARD_DAILY_MINUTES);
    }
  });
});

describe("TEST 11: 총 사용량이 잔여 연차를 넘지 않는다", () => {
  it("7.5일을 주면 어떤 전략도 7일(정수 환산)을 넘지 않는다", () => {
    const { input } = makeSpreadScenario(7.5);
    const budget = 7.5 * STANDARD_DAILY_MINUTES;

    for (const strategy of Object.values(VacationStrategy)) {
      const result = runStrategy(input, strategy);
      expect(result.summary.leaveMinutesUsed).toBeLessThanOrEqual(budget);
      expect(result.portfolio.remainingLeaveMinutes).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("TEST 12: 후보 중복 금지", () => {
  it("선택된 후보끼리 날짜가 겹치지 않는다", () => {
    const { input } = makeSpreadScenario(12);

    for (const strategy of Object.values(VacationStrategy)) {
      const { selectedCandidates } = runStrategy(input, strategy).portfolio;
      for (let i = 0; i < selectedCandidates.length; i++) {
        for (let j = i + 1; j < selectedCandidates.length; j++) {
          expect(hasCandidateOverlap(selectedCandidates[i], selectedCandidates[j])).toBe(false);
        }
      }
    }
  });

  it("겹치는 날을 두 번 세지 않는다", () => {
    const { input } = makeSpreadScenario(12);
    const { portfolio } = runStrategy(input, VacationStrategy.FrequentBreaks);

    const summed = portfolio.selectedCandidates.reduce(
      (total, candidate) => total + candidate.consecutiveFullRestDays,
      0,
    );
    expect(portfolio.totalDistinctRestDays).toBe(summed);
  });
});

describe("TEST 13: 수시 휴가는 분산된다", () => {
  it("같은 달에 몰리지 않고 여러 달에 흩어진다", () => {
    const { input } = makeSpreadScenario(8);
    const frequent = runStrategy(input, VacationStrategy.FrequentBreaks).portfolio;

    expect(frequent.selectedCandidates.length).toBeGreaterThanOrEqual(2);

    // 선택된 휴가들 사이에 전략이 요구하는 최소 간격이 지켜진다.
    const minGapDays = STRATEGY_RULES[VacationStrategy.FrequentBreaks].minGapDaysBetweenCandidates;
    const sorted = [...frequent.selectedCandidates].sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    );
    for (let i = 1; i < sorted.length; i++) {
      expect(differenceInDays(sorted[i - 1].endDate, sorted[i].startDate)).toBeGreaterThan(
        minGapDays,
      );
    }

    const months = new Set(sorted.map((candidate) => candidate.startDate.slice(0, 7)));
    expect(months.size).toBeGreaterThanOrEqual(2);
  });
});

describe("TEST 14 & 15: 전략별 랭킹이 실제로 달라진다", () => {
  it("연차 절약은 효율을, 장기 집중은 길이를 우선한다", () => {
    const { input } = makeSpreadScenario(8);

    const longBreak = runStrategy(input, VacationStrategy.LongBreak).portfolio;
    const leaveSaving = runStrategy(input, VacationStrategy.LeaveSaving).portfolio;

    const longestBlock = (portfolio: typeof longBreak) =>
      Math.max(...portfolio.selectedCandidates.map((c) => c.consecutiveFullRestDays));

    // 장기 집중은 더 긴 단일 휴가를 만든다.
    expect(longestBlock(longBreak)).toBeGreaterThan(longestBlock(leaveSaving));
    // 연차 절약은 연차를 더 적게 쓰고 효율이 더 높다.
    expect(leaveSaving.totalAnnualLeaveMinutesUsed).toBeLessThan(
      longBreak.totalAnnualLeaveMinutesUsed,
    );
    expect(leaveSaving.portfolioEfficiency).toBeGreaterThan(longBreak.portfolioEfficiency);
  });

  it("세 전략이 서로 다른 날짜 조합을 내놓는다", () => {
    const { input } = makeSpreadScenario(8);

    const signature = (strategy: VacationStrategy) =>
      runStrategy(input, strategy)
        .portfolio.selectedCandidates.map((c) => `${c.startDate}~${c.endDate}`)
        .join("|");

    const long = signature(VacationStrategy.LongBreak);
    const frequent = signature(VacationStrategy.FrequentBreaks);
    const saving = signature(VacationStrategy.LeaveSaving);

    expect(new Set([long, frequent, saving]).size).toBe(3);
  });
});

describe("부분휴가는 기본 추천에서 제외된다", () => {
  it("기본값에서는 포트폴리오에 반차/시간차 후보가 들어가지 않는다", () => {
    const { input } = makeScenario({
      days: 200,
      annualLeaveDays: 7.5,
      halfDayEnabled: true,
      hourlyUnitMinutes: 60,
      holidays: [holiday(addDays(findDayOfWeek(addDays(FIXTURE_ORIGIN, 7), MONDAY), 1), "H1")],
    });
    const engine = createVacationEngine();

    for (const strategy of Object.values(VacationStrategy)) {
      const result = engine.optimize({ ...input, strategy });
      for (const candidate of result.portfolio.selectedCandidates) {
        expect(candidate.partialMetrics, `${strategy}`).toBeUndefined();
      }
      // 후보 자체는 계속 생성·평가된다(플래그만 껐을 뿐).
      expect(result.rankedCandidates.some((item) => item.candidate.partialMetrics)).toBe(true);
    }
  });

  it("플래그를 켜면 부분휴가 후보도 추천에 포함될 수 있다", () => {
    const { input } = makeScenario({
      days: 200,
      annualLeaveDays: 7.5,
      halfDayEnabled: true,
      hourlyUnitMinutes: 60,
    });
    const engine = createVacationEngine();

    const withPartial = engine.optimize({
      ...input,
      strategy: VacationStrategy.FrequentBreaks,
      includePartialLeaveInPortfolio: true,
    });
    const withoutPartial = engine.optimize({
      ...input,
      strategy: VacationStrategy.FrequentBreaks,
    });

    const signature = (result: typeof withPartial) =>
      result.portfolio.selectedCandidates.map((c) => c.id).join("|");
    expect(signature(withPartial)).not.toBe(signature(withoutPartial));
  });
});

describe("§44: 결정적 동작", () => {
  it("같은 입력이면 항상 같은 결과가 나온다", () => {
    const { input } = makeSpreadScenario(7.5);
    const first = runStrategy(input, VacationStrategy.Balanced);
    const second = runStrategy(input, VacationStrategy.Balanced);

    expect(first.portfolio.selectedCandidates.map((c) => c.id)).toEqual(
      second.portfolio.selectedCandidates.map((c) => c.id),
    );
    expect(first.portfolio.score).toBe(second.portfolio.score);
  });
});

describe("§34/§51: 전략 변경 시 후보 풀 재사용", () => {
  it("전략만 바뀌면 달력·후보를 다시 만들지 않는다", () => {
    const { input } = makeSpreadScenario(7.5);
    let poolBuilds = 0;
    const engine = createVacationEngine({ onPoolBuilt: () => poolBuilds++ });

    engine.optimize({ ...input, strategy: VacationStrategy.LongBreak });
    engine.optimize({ ...input, strategy: VacationStrategy.FrequentBreaks });
    engine.optimize({ ...input, strategy: VacationStrategy.LeaveSaving });

    expect(poolBuilds).toBe(1);
  });

  it("연차가 바뀌면 후보 풀을 다시 만든다", () => {
    const { input } = makeSpreadScenario(7.5);
    let poolBuilds = 0;
    const engine = createVacationEngine({ onPoolBuilt: () => poolBuilds++ });

    engine.optimize({ ...input, strategy: VacationStrategy.LongBreak });

    const cheaper = makeSpreadScenario(3).input;
    engine.optimize({ ...cheaper, strategy: VacationStrategy.LongBreak });

    expect(poolBuilds).toBe(2);
  });
});

describe("§43: 성능", () => {
  it("1년치 달력 + 연차 15일을 즉시 계산한다", () => {
    const { input } = makeScenario({
      days: 365,
      annualLeaveDays: 15,
      halfDayEnabled: true,
      hourlyUnitMinutes: 60,
      holidays: Array.from({ length: 16 }, (_, i) =>
        holiday(addDays(FIXTURE_ORIGIN, 14 + i * 21), `공휴일 ${i}`),
      ),
    });

    const engine = createVacationEngine();
    const startedAt = performance.now();
    const result = engine.optimize({ ...input, strategy: VacationStrategy.Balanced });
    const elapsed = performance.now() - startedAt;

    expect(result.portfolio.selectedCandidates.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(2000);
  });
});
