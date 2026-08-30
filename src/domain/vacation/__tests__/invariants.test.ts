import { describe, expect, it } from "vitest";
import {
  FIXTURE_ORIGIN,
  MONDAY,
  STANDARD_DAILY_MINUTES,
  findDayOfWeek,
  holiday,
  makeScenario,
} from "./fixtures";
import { addDays, eachDayInRange } from "../models/local-date";
import { createVacationEngine } from "../engine";
import { createDefaultConstraints } from "../constraints/built-in-constraints";
import { validateCandidate } from "../constraints/validate-candidate";
import { VacationStrategy } from "../models/vacation-plan";

/** 여러 형태의 달력을 한꺼번에 돌려 불변식을 검사한다 (§46). */
function makeVariedScenarios() {
  const monday = findDayOfWeek(addDays(FIXTURE_ORIGIN, 7), MONDAY);
  return [
    { name: "공휴일 없음", scenario: makeScenario({ days: 120, annualLeaveDays: 7.5 }) },
    {
      name: "공휴일 산재 + 반차/시간차",
      scenario: makeScenario({
        days: 180,
        annualLeaveDays: 7.5,
        halfDayEnabled: true,
        hourlyUnitMinutes: 60,
        holidays: [
          holiday(addDays(monday, 1), "H1"),
          holiday(addDays(monday, 2), "H2"),
          holiday(addDays(monday, 45), "H3"),
          holiday(addDays(monday, 90), "H4"),
        ],
      }),
    },
    {
      name: "회사 휴무 + 차단일",
      scenario: makeScenario({
        days: 120,
        annualLeaveDays: 5,
        companyHolidays: [
          {
            id: "summer",
            name: "여름휴무",
            startDate: addDays(monday, 30),
            endDate: addDays(monday, 32),
            recurring: false,
          },
        ],
        blockedDates: [addDays(monday, 10), addDays(monday, 11)],
      }),
    },
    { name: "연차 0일", scenario: makeScenario({ days: 60, annualLeaveDays: 0 }) },
  ];
}

describe("불변식: 후보 자체", () => {
  it("종료일이 시작일보다 앞서지 않는다", () => {
    for (const { name, scenario } of makeVariedScenarios()) {
      for (const candidate of scenario.candidates) {
        expect(candidate.endDate >= candidate.startDate, name).toBe(true);
        expect(candidate.restEndDateTime > candidate.restStartDateTime, name).toBe(true);
      }
    }
  });

  it("자연 휴일에는 휴가를 소비하지 않고, 그 날 근무시간을 넘겨 쓰지도 않는다", () => {
    for (const { name, scenario } of makeVariedScenarios()) {
      for (const candidate of scenario.candidates) {
        for (const usage of candidate.leaveUsages) {
          const day = scenario.index.dayAt(scenario.index.indexOf(usage.date));
          expect(day, `${name} ${usage.date}`).toBeDefined();
          expect(day!.scheduledWorkMinutes, `${name} ${usage.date}`).toBeGreaterThan(0);
          expect(usage.minutes).toBeLessThanOrEqual(day!.scheduledWorkMinutes);
        }
      }
    }
  });

  it("차단일에는 절대 휴가를 배치하지 않는다", () => {
    const monday = findDayOfWeek(addDays(FIXTURE_ORIGIN, 7), MONDAY);
    const blocked = [addDays(monday, 10), addDays(monday, 11)];
    const { candidates } = makeScenario({ days: 120, annualLeaveDays: 5, blockedDates: blocked });

    for (const candidate of candidates) {
      for (const usage of candidate.leaveUsages) {
        expect(blocked).not.toContain(usage.date);
      }
    }
  });

  it("모든 후보가 제약 조건을 통과한다", () => {
    const constraints = createDefaultConstraints();
    for (const { name, scenario } of makeVariedScenarios()) {
      const context = {
        index: scenario.index,
        schedule: scenario.schedule,
        leaveCatalog: scenario.leaveCatalog,
        annualLeaveRemainingMinutes:
          scenario.leaveCatalog.find((type) => type.id === "annual")?.remainingMinutes ?? 0,
      };
      for (const candidate of scenario.candidates) {
        const outcome = validateCandidate(candidate, constraints, context);
        expect(outcome.failures, `${name}: ${JSON.stringify(outcome.failures)}`).toHaveLength(0);
      }
    }
  });
});

describe("불변식: 포트폴리오", () => {
  it("사용한 휴가가 보유량을 넘지 않는다", () => {
    for (const { name, scenario } of makeVariedScenarios()) {
      const available =
        scenario.leaveCatalog.find((type) => type.id === "annual")?.remainingMinutes ?? 0;
      const engine = createVacationEngine();

      for (const strategy of Object.values(VacationStrategy)) {
        const result = engine.optimize({ ...scenario.input, strategy });
        expect(result.summary.leaveMinutesUsed, `${name}/${strategy}`).toBeLessThanOrEqual(
          available,
        );
        expect(result.portfolio.remainingLeaveMinutes).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("휴식일을 중복해서 세지 않는다", () => {
    for (const { name, scenario } of makeVariedScenarios()) {
      const engine = createVacationEngine();
      for (const strategy of Object.values(VacationStrategy)) {
        const { portfolio } = engine.optimize({ ...scenario.input, strategy });

        const union = new Set<string>();
        for (const candidate of portfolio.selectedCandidates) {
          for (const date of eachDayInRange(candidate.startDate, candidate.endDate)) {
            union.add(date);
          }
        }
        expect(portfolio.totalDistinctRestDays, `${name}/${strategy}`).toBe(union.size);
      }
    }
  });

  it("연차가 없으면 아무것도 추천하지 않는다", () => {
    const scenario = makeScenario({ days: 60, annualLeaveDays: 0 });
    const engine = createVacationEngine();
    const result = engine.optimize({ ...scenario.input, strategy: VacationStrategy.LongBreak });

    expect(result.portfolio.selectedCandidates).toHaveLength(0);
    expect(result.summary.leaveMinutesUsed).toBe(0);
    expect(result.summary.efficiency).toBe(0);
  });

  it("효율 계산에서 0으로 나누지 않는다", () => {
    for (const { scenario } of makeVariedScenarios()) {
      const engine = createVacationEngine();
      for (const strategy of Object.values(VacationStrategy)) {
        const result = engine.optimize({ ...scenario.input, strategy });
        expect(Number.isFinite(result.summary.efficiency)).toBe(true);
        expect(Number.isNaN(result.summary.efficiency)).toBe(false);
      }
    }
  });

  it("오버레이가 포트폴리오와 정확히 일치한다", () => {
    const monday = findDayOfWeek(addDays(FIXTURE_ORIGIN, 7), MONDAY);
    const scenario = makeScenario({
      days: 180,
      annualLeaveDays: 7.5,
      halfDayEnabled: true,
      holidays: [holiday(addDays(monday, 1), "H1"), holiday(addDays(monday, 45), "H2")],
    });
    const engine = createVacationEngine();
    const result = engine.optimize({ ...scenario.input, strategy: VacationStrategy.Balanced });

    expect(result.calendarOverlay.ranges).toHaveLength(
      result.portfolio.selectedCandidates.length,
    );

    for (const range of result.calendarOverlay.ranges) {
      const candidate = result.portfolio.selectedCandidates.find(
        (item) => item.id === range.candidateId,
      );
      expect(candidate).toBeDefined();
      expect(range.startDate).toBe(candidate!.startDate);
      expect(range.endDate).toBe(candidate!.endDate);
      // 종일 휴가 + 부분 휴가를 합치면 후보의 전체 휴가 사용 내역과 같다.
      expect(range.leaveDates.length + range.partialLeaveDates.length).toBe(
        candidate!.leaveUsages.length,
      );
      expect(range.headline).toMatch(/연차 .*→ .*일 휴식/);
      expect(range.label.length).toBeGreaterThan(0);
    }
  });

  it("사용 분과 일수 환산이 서로 일치한다", () => {
    const monday = findDayOfWeek(addDays(FIXTURE_ORIGIN, 7), MONDAY);
    const scenario = makeScenario({
      days: 180,
      annualLeaveDays: 10,
      holidays: [holiday(addDays(monday, 1), "H1")],
    });
    const engine = createVacationEngine();
    const result = engine.optimize({ ...scenario.input, strategy: VacationStrategy.LongBreak });

    expect(result.summary.leaveDaysUsed).toBeCloseTo(
      result.summary.leaveMinutesUsed / STANDARD_DAILY_MINUTES,
      1,
    );
  });
});
