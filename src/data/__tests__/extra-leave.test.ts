import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMPANY_POLICY,
  extraLeavesForYear,
  oneTimeExtraLeaves,
  totalLeaveDays,
  type CompanyPolicy,
  type ExtraLeaveEntry,
} from "../companyPolicy";
import {
  LeaveCategory,
  LeaveDurationBasis,
  VacationStrategy,
  createDefaultLeaveCatalog,
  createVacationEngine,
  createWorkSchedule,
  localDate,
} from "../../domain/vacation";
import { getHolidaySet } from "../holidayProvider";

/** 2027년에만 주어지는 리프레시휴가 2주(근무일 10일). */
const REFRESH_2027: ExtraLeaveEntry = {
  id: "refresh",
  name: "리프레시휴가",
  days: 10,
  year: 2027,
  continuous: true,
};

/** 매년 주는 보상휴가 (연도 없음 = 기존 데이터 형태). */
const LEGACY_EVERY_YEAR: ExtraLeaveEntry = {
  id: "legacy",
  name: "보상휴가",
  days: 3,
};

function policyWith(extras: ExtraLeaveEntry[]): CompanyPolicy {
  return { ...DEFAULT_COMPANY_POLICY, baseLeaveDays: 15, extraLeaves: extras };
}

describe("연도별 추가 휴가", () => {
  it("2027년에만 있는 휴가는 2027년에만 잡힌다", () => {
    const policy = policyWith([REFRESH_2027]);
    expect(extraLeavesForYear(policy, 2027).map((e) => e.name)).toEqual(["리프레시휴가"]);
    expect(extraLeavesForYear(policy, 2026)).toEqual([]);
    expect(extraLeavesForYear(policy, 2028)).toEqual([]);
  });

  it("전체 휴가일수가 연도마다 다르게 계산된다", () => {
    const policy = policyWith([REFRESH_2027]);
    expect(totalLeaveDays(policy, 2026)).toBe(15);
    expect(totalLeaveDays(policy, 2027)).toBe(25);
    expect(totalLeaveDays(policy, 2028)).toBe(15);
  });

  it("연도가 없는 기존 항목은 모든 연도에 적용된다(하위 호환)", () => {
    const policy = policyWith([LEGACY_EVERY_YEAR]);
    expect(totalLeaveDays(policy, 2026)).toBe(18);
    expect(totalLeaveDays(policy, 2027)).toBe(18);
    expect(totalLeaveDays(policy, 2028)).toBe(18);
  });

  it("매년 항목과 일회성 항목이 섞여도 각각 맞게 더해진다", () => {
    const policy = policyWith([LEGACY_EVERY_YEAR, REFRESH_2027]);
    expect(totalLeaveDays(policy, 2026)).toBe(18); // 15 + 보상 3
    expect(totalLeaveDays(policy, 2027)).toBe(28); // 15 + 보상 3 + 리프레시 10
  });

  it("일회성 휴가만 따로 골라낼 수 있다", () => {
    const policy = policyWith([LEGACY_EVERY_YEAR, REFRESH_2027]);
    expect(oneTimeExtraLeaves(policy, 2027).map((e) => e.name)).toEqual(["리프레시휴가"]);
    expect(oneTimeExtraLeaves(policy, 2026)).toEqual([]);
  });
});

describe("연속 사용 휴가가 엔진 카탈로그로 넘어간다", () => {
  const base = {
    annualRemainingMinutes: 8 * 480,
    standardDailyWorkMinutes: 480,
  };

  it("연속 휴가는 특별휴가 종류로 만들어진다", () => {
    const catalog = createDefaultLeaveCatalog({
      ...base,
      extraLeaves: [{ id: "extra-refresh", name: "리프레시휴가", days: 10, continuous: true }],
    });

    const special = catalog.find((type) => type.id === "extra-refresh");
    expect(special).toBeDefined();
    expect(special?.category).toBe(LeaveCategory.Special);
    expect(special?.durationDays).toBe(10);
    // 근무일 기준이라 주말·공휴일은 소진되지 않고 그 위에 얹힌다.
    expect(special?.durationBasis).toBe(LeaveDurationBasis.WorkingDay);
    // 연차에서 차감되지 않아야 한다. 별도로 부여받은 휴가이기 때문이다.
    expect(special?.deductsFromAnnualLeave).toBe(false);
    expect(special?.mustUseContinuously).toBe(true);
  });

  it("나눠 쓸 수 있는 휴가는 별도 종류를 만들지 않는다", () => {
    const catalog = createDefaultLeaveCatalog({
      ...base,
      extraLeaves: [{ id: "extra-comp", name: "보상휴가", days: 3, continuous: false }],
    });
    expect(catalog.find((type) => type.id === "extra-comp")).toBeUndefined();
    // 연차·반차만 남는다.
    expect(catalog.every((type) => type.category !== LeaveCategory.Special)).toBe(true);
  });

  it("달력일 기준도 지정할 수 있다", () => {
    const catalog = createDefaultLeaveCatalog({
      ...base,
      extraLeaves: [
        {
          id: "extra-cal",
          name: "안식휴가",
          days: 14,
          continuous: true,
          countsCalendarDays: true,
        },
      ],
    });
    expect(catalog.find((t) => t.id === "extra-cal")?.durationBasis).toBe(
      LeaveDurationBasis.CalendarDay,
    );
  });

  it("추가 휴가가 없으면 카탈로그가 예전과 똑같다(회귀 방지)", () => {
    const withEmpty = createDefaultLeaveCatalog({ ...base, extraLeaves: [] });
    const withNone = createDefaultLeaveCatalog(base);
    expect(withEmpty).toEqual(withNone);
    expect(withNone.map((t) => t.id)).toEqual(["annual", "half-day"]);
  });
});

describe("리프레시휴가가 실제 추천에 나온다", () => {
  const dateRange = { startDate: localDate(2027, 1, 1), endDate: localDate(2027, 12, 31) };

  function run(extras: Parameters<typeof createDefaultLeaveCatalog>[0]["extraLeaves"]) {
    const engine = createVacationEngine();
    return engine.optimize({
      dateRange,
      workSchedule: createWorkSchedule({ workingDays: [1, 2, 3, 4, 5] }),
      holidays: getHolidaySet(dateRange.startDate, dateRange.endDate),
      companyHolidays: [],
      leaveCatalog: createDefaultLeaveCatalog({
        annualRemainingMinutes: 15 * 480,
        annualTotalMinutes: 25 * 480,
        halfDayEnabled: true,
        standardDailyWorkMinutes: 480,
        validUntil: localDate(2027, 12, 31),
        extraLeaves: extras,
      }),
      strategy: VacationStrategy.LongBreak,
      includeSpecialLeave: (extras?.length ?? 0) > 0,
    });
  }

  it("리프레시휴가 10일이 추천 조합에 포함된다", () => {
    const result = run([
      { id: "extra-refresh", name: "리프레시휴가", days: 10, continuous: true },
    ]);
    const picked = result.portfolio.selectedCandidates;
    const refresh = picked.filter((c) => c.specialLeaveMinutesUsed > 0);

    expect(refresh.length).toBe(1);
    // 근무일 10일이 주말·공휴일을 흡수해 훨씬 길게 쉰다.
    expect(refresh[0].consecutiveFullRestDays).toBeGreaterThan(10);
    // 연차는 한 푼도 쓰지 않아야 한다.
    expect(refresh[0].annualLeaveMinutesUsed).toBe(0);
  });

  it("리프레시휴가를 써도 연차 조합이 함께 추천된다(예산이 다르므로)", () => {
    const result = run([
      { id: "extra-refresh", name: "리프레시휴가", days: 10, continuous: true },
    ]);
    const picked = result.portfolio.selectedCandidates;
    expect(picked.filter((c) => c.specialLeaveMinutesUsed > 0).length).toBe(1);
    expect(picked.filter((c) => c.specialLeaveMinutesUsed === 0).length).toBeGreaterThan(0);
  });

  it("리프레시휴가는 연차를 축내지 않는다", () => {
    const withRefresh = run([
      { id: "extra-refresh", name: "리프레시휴가", days: 10, continuous: true },
    ]);
    const withoutRefresh = run([]);
    // 연차 사용량은 리프레시휴가 유무와 무관해야 한다.
    expect(withRefresh.portfolio.totalAnnualLeaveMinutesUsed).toBeLessThanOrEqual(15 * 480);
    // 총 휴식일은 리프레시휴가가 있을 때 더 길어야 한다.
    expect(withRefresh.portfolio.totalDistinctRestDays).toBeGreaterThan(
      withoutRefresh.portfolio.totalDistinctRestDays,
    );
  });

  it("추가 휴가가 없으면 결과가 예전과 똑같다(회귀 방지)", () => {
    const a = run([]);
    const b = run(undefined);
    expect(a.calendarOverlay.ranges.map((r) => r.candidateId)).toEqual(
      b.calendarOverlay.ranges.map((r) => r.candidateId),
    );
  });
});
