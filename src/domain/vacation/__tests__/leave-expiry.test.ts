import { describe, expect, it } from "vitest";
import { FIXTURE_ORIGIN, MONDAY, findDayOfWeek, holiday, makeScenario } from "./fixtures";
import { addDays, asLocalDate } from "../models/local-date";
import { createDefaultLeaveCatalog } from "../models/leave-type";
import { createVacationEngine } from "../engine";
import { VacationStrategy } from "../models/vacation-plan";
import { STANDARD_DAILY_MINUTES } from "./fixtures";

/**
 * 연차 소멸기한: 회사마다 12/31 또는 다음 해 3월 등에 연차가 소멸한다.
 * 소멸일 이후에는 연차를 배치하면 안 된다.
 */
function makeExpiryScenario(expiry: string, annualLeaveDays = 10) {
  const monday = findDayOfWeek(addDays(FIXTURE_ORIGIN, 7), MONDAY);
  const scenario = makeScenario({
    days: 300,
    annualLeaveDays,
    holidays: [
      holiday(addDays(monday, 1), "연휴 A"),
      holiday(addDays(monday, 120), "연휴 B"),
      holiday(addDays(monday, 200), "연휴 C"),
    ],
  });

  const leaveCatalog = createDefaultLeaveCatalog({
    annualRemainingMinutes: annualLeaveDays * STANDARD_DAILY_MINUTES,
    standardDailyWorkMinutes: STANDARD_DAILY_MINUTES,
    halfDayEnabled: false,
    hourlyUnitMinutes: null,
    validUntil: asLocalDate(expiry),
  });

  return { ...scenario, input: { ...scenario.input, leaveCatalog } };
}

describe("연차 소멸기한", () => {
  it("소멸일 이후 날짜에는 연차를 배치하지 않는다", () => {
    const expiry = "2030-04-30";
    const { input } = makeExpiryScenario(expiry);
    const engine = createVacationEngine();

    for (const strategy of Object.values(VacationStrategy)) {
      const result = engine.optimize({ ...input, strategy });
      for (const candidate of result.portfolio.selectedCandidates) {
        for (const usage of candidate.leaveUsages) {
          expect(usage.date <= expiry, `${strategy} ${usage.date}`).toBe(true);
        }
      }
      // 후보 풀 자체에도 소멸일 이후 연차가 없어야 한다.
      for (const scored of result.rankedCandidates) {
        for (const usage of scored.candidate.leaveUsages) {
          expect(usage.date <= expiry).toBe(true);
        }
      }
    }
  });

  it("휴식 구간은 소멸일을 넘어 이어질 수 있다 (연차만 기한 내면 된다)", () => {
    // 소멸일 다음 날이 공휴일이면, 소멸일 전에 연차를 쓰고 그 뒤로 쉬는 것은 정당하다.
    const monday = findDayOfWeek(addDays(FIXTURE_ORIGIN, 7), MONDAY);
    const expiry = addDays(monday, 2); // 수요일
    const scenario = makeScenario({
      days: 60,
      annualLeaveDays: 5,
      holidays: [holiday(addDays(monday, 3), "소멸일 다음날 공휴일")],
    });

    const leaveCatalog = createDefaultLeaveCatalog({
      annualRemainingMinutes: 5 * STANDARD_DAILY_MINUTES,
      standardDailyWorkMinutes: STANDARD_DAILY_MINUTES,
      halfDayEnabled: false,
      hourlyUnitMinutes: null,
      validUntil: expiry,
    });

    const engine = createVacationEngine();
    const result = engine.optimize({
      ...scenario.input,
      leaveCatalog,
      strategy: VacationStrategy.LongBreak,
    });

    const spansPastExpiry = result.rankedCandidates.some(
      (scored) => scored.candidate.endDate > expiry,
    );
    expect(spansPastExpiry).toBe(true);

    // 그래도 연차 자체는 전부 기한 안에 있어야 한다.
    for (const scored of result.rankedCandidates) {
      for (const usage of scored.candidate.leaveUsages) {
        expect(usage.date <= expiry).toBe(true);
      }
    }
  });

  it("소멸일이 이미 지났으면 아무것도 추천하지 않는다", () => {
    const { input } = makeExpiryScenario("2029-12-31");
    const engine = createVacationEngine();
    const result = engine.optimize({ ...input, strategy: VacationStrategy.LongBreak });

    expect(result.portfolio.selectedCandidates).toHaveLength(0);
    expect(result.summary.leaveMinutesUsed).toBe(0);
  });

  it("소멸일이 길어지면 더 많은 기회를 찾는다", () => {
    const engine = createVacationEngine();

    const short = engine.optimize({
      ...makeExpiryScenario("2030-03-31").input,
      strategy: VacationStrategy.FrequentBreaks,
    });
    const long = engine.optimize({
      ...makeExpiryScenario("2030-10-31").input,
      strategy: VacationStrategy.FrequentBreaks,
    });

    expect(long.rankedCandidates.length).toBeGreaterThan(short.rankedCandidates.length);
    expect(long.portfolio.selectedCandidates.length).toBeGreaterThanOrEqual(
      short.portfolio.selectedCandidates.length,
    );
  });
});
