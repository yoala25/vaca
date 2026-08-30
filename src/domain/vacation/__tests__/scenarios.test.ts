import { describe, expect, it } from "vitest";
import {
  FRIDAY,
  MONDAY,
  SATURDAY,
  STANDARD_DAILY_MINUTES,
  THURSDAY,
  TUESDAY,
  findDayOfWeek,
  findFullDayCandidate,
  holiday,
  makeScenario,
  substituteHoliday,
} from "./fixtures";
import { FIXTURE_ORIGIN } from "./fixtures";
import { addDays, asLocalDate, atTime, type LocalDate } from "../models/local-date";
import { LeaveCategory, LeaveDurationBasis, LeaveSlot } from "../models/leave-type";
import { indexHolidays } from "../calendar/build-calendar";
import { HolidayType } from "../models/holiday";

/** 테스트 가독성을 위해: 특정 요일의 날짜를 잡아 그 주 전체를 계산한다. */
function weekAround(anchor: LocalDate) {
  return {
    at: (offset: number) => addDays(anchor, offset),
  };
}

describe("TEST 1: 금요일 연차 + 주말 = 3일 휴식", () => {
  it("공휴일이 없어도 금요일 연차 하나로 3일이 만들어진다", () => {
    const friday = findDayOfWeek(addDays(FIXTURE_ORIGIN, 7), FRIDAY);
    const sunday = addDays(friday, 2);
    const { candidates } = makeScenario();

    const candidate = findFullDayCandidate(candidates, friday, sunday);
    expect(candidate).toBeDefined();
    expect(candidate!.consecutiveFullRestDays).toBe(3);
    expect(candidate!.annualLeaveEquivalentDays).toBe(1);
    expect(candidate!.efficiencyScore).toBe(3);
    expect(candidate!.leaveDates).toEqual([friday]);
  });
});

describe("TEST 2: 월요일 공휴일 + 금요일 연차 = 금~월 4일 휴식", () => {
  it("주말 뒤 공휴일까지 이어진다", () => {
    const friday = findDayOfWeek(addDays(FIXTURE_ORIGIN, 7), FRIDAY);
    const monday = addDays(friday, 3);
    const { candidates } = makeScenario({ holidays: [holiday(monday, "월요일 공휴일")] });

    const candidate = findFullDayCandidate(candidates, friday, monday);
    expect(candidate).toBeDefined();
    expect(candidate!.consecutiveFullRestDays).toBe(4);
    expect(candidate!.annualLeaveEquivalentDays).toBe(1);
    expect(candidate!.efficiencyScore).toBe(4);
    expect(candidate!.publicHolidayDates).toEqual([monday]);
  });
});

describe("TEST 3: 화요일 공휴일 + 월요일 연차 = 토~화 4일 휴식", () => {
  it("주말 앞으로 이어붙는다", () => {
    const tuesday = findDayOfWeek(addDays(FIXTURE_ORIGIN, 7), TUESDAY);
    const monday = addDays(tuesday, -1);
    const saturday = addDays(tuesday, -3);
    const { candidates } = makeScenario({ holidays: [holiday(tuesday, "화요일 공휴일")] });

    const candidate = findFullDayCandidate(candidates, saturday, tuesday);
    expect(candidate).toBeDefined();
    expect(candidate!.consecutiveFullRestDays).toBe(4);
    expect(candidate!.leaveDates).toEqual([monday]);
    expect(candidate!.efficiencyScore).toBe(4);
  });
});

describe("TEST 4: 목요일 공휴일 + 금요일 연차 = 목~일 4일 휴식", () => {
  it("공휴일 뒤 주말까지 이어진다", () => {
    const thursday = findDayOfWeek(addDays(FIXTURE_ORIGIN, 7), THURSDAY);
    const friday = addDays(thursday, 1);
    const sunday = addDays(thursday, 3);
    const { candidates } = makeScenario({ holidays: [holiday(thursday, "목요일 공휴일")] });

    const candidate = findFullDayCandidate(candidates, thursday, sunday);
    expect(candidate).toBeDefined();
    expect(candidate!.consecutiveFullRestDays).toBe(4);
    expect(candidate!.leaveDates).toEqual([friday]);
  });
});

describe("TEST 5: 공휴일 두 개 사이 평일 2일", () => {
  it("연차 2일이면 화~일 6일, 3일이면 양쪽 주말까지 9일이 된다", () => {
    const monday = findDayOfWeek(addDays(FIXTURE_ORIGIN, 7), MONDAY);
    const week = weekAround(monday);
    const tuesday = week.at(1);
    const wednesday = week.at(2);
    const thursday = week.at(3);
    const friday = week.at(4);
    const sunday = week.at(6);
    const previousSaturday = week.at(-2);

    const { candidates } = makeScenario({
      holidays: [holiday(tuesday, "화요일 공휴일"), holiday(friday, "금요일 공휴일")],
    });

    const twoDays = findFullDayCandidate(candidates, tuesday, sunday);
    expect(twoDays).toBeDefined();
    expect(twoDays!.consecutiveFullRestDays).toBe(6);
    expect(twoDays!.leaveDates).toEqual([wednesday, thursday]);

    const threeDays = findFullDayCandidate(candidates, previousSaturday, sunday);
    expect(threeDays).toBeDefined();
    expect(threeDays!.consecutiveFullRestDays).toBe(9);
    expect(threeDays!.leaveDates).toEqual([monday, wednesday, thursday]);
    expect(threeDays!.efficiencyScore).toBe(3);
  });
});

describe("TEST 6: 금요일 오후반차 + 주말", () => {
  it("휴식이 금요일 13:00부터 시작된다", () => {
    const friday = findDayOfWeek(addDays(FIXTURE_ORIGIN, 7), FRIDAY);
    const saturday = addDays(friday, 1);
    const sunday = addDays(friday, 2);
    const { candidates } = makeScenario({ halfDayEnabled: true });

    // 오후반차 하나만 붙인 후보(월요일 반차까지 겹친 조합은 제외)
    const candidate = candidates.find(
      (item) =>
        item.startDate === saturday &&
        item.endDate === sunday &&
        item.leaveUsages.length === 1 &&
        item.leaveUsages[0].date === friday &&
        item.leaveUsages[0].slot === LeaveSlot.Afternoon,
    );

    expect(candidate).toBeDefined();
    expect(candidate!.restStartDateTime).toBe(atTime(friday, "13:00" as never));
    expect(candidate!.totalLeaveMinutesUsed).toBe(STANDARD_DAILY_MINUTES / 2);
    expect(candidate!.partialMetrics?.extensionMinutesComparedToNormal).toBe(300); // 13:00 → 18:00
  });
});

describe("TEST 7: 월요일 오전반차 + 주말", () => {
  it("휴식이 월요일 13:00까지 이어진다", () => {
    const saturday = findDayOfWeek(addDays(FIXTURE_ORIGIN, 7), SATURDAY);
    const sunday = addDays(saturday, 1);
    const monday = addDays(saturday, 2);
    const { candidates } = makeScenario({ halfDayEnabled: true });

    // 오전반차 하나만 붙인 후보(금요일 반차까지 겹친 조합은 제외)
    const candidate = candidates.find(
      (item) =>
        item.startDate === saturday &&
        item.endDate === sunday &&
        item.leaveUsages.length === 1 &&
        item.leaveUsages[0].date === monday &&
        item.leaveUsages[0].slot === LeaveSlot.Morning,
    );

    expect(candidate).toBeDefined();
    expect(candidate!.restEndDateTime).toBe(atTime(monday, "13:00" as never));
    expect(candidate!.partialMetrics?.extensionMinutesComparedToNormal).toBe(240); // 09:00 → 13:00
  });
});

describe("TEST 8: 금요일 2시간차", () => {
  it("정상 퇴근보다 120분 먼저 휴식이 시작된다", () => {
    const friday = findDayOfWeek(addDays(FIXTURE_ORIGIN, 7), FRIDAY);
    const saturday = addDays(friday, 1);
    const sunday = addDays(friday, 2);
    const { candidates } = makeScenario({ hourlyUnitMinutes: 60 });

    const candidate = candidates.find(
      (item) =>
        item.startDate === saturday &&
        item.endDate === sunday &&
        item.leaveUsages.length === 1 &&
        item.leaveUsages[0].date === friday &&
        item.leaveUsages[0].slot === LeaveSlot.DayEnd &&
        item.leaveUsages[0].minutes === 120,
    );

    expect(candidate).toBeDefined();
    expect(candidate!.restStartDateTime).toBe(atTime(friday, "16:00" as never));
    expect(candidate!.partialMetrics?.extensionMinutesComparedToNormal).toBe(120);
    expect(candidate!.hourlyLeaveMinutesUsed).toBe(120);
  });
});

describe("TEST 9: 회사 지정 휴무일", () => {
  it("평일 회사 휴무가 주말·연차와 자연스럽게 연결된다", () => {
    const monday = findDayOfWeek(addDays(FIXTURE_ORIGIN, 7), MONDAY);
    const tuesday = addDays(monday, 1);
    const previousSaturday = addDays(monday, -2);

    const { candidates } = makeScenario({
      companyHolidays: [
        {
          id: "founding",
          name: "창립기념일",
          startDate: monday,
          endDate: monday,
          recurring: false,
        },
      ],
    });

    const candidate = findFullDayCandidate(candidates, previousSaturday, tuesday);
    expect(candidate).toBeDefined();
    expect(candidate!.consecutiveFullRestDays).toBe(4);
    expect(candidate!.companyHolidayDates).toEqual([monday]);
    expect(candidate!.leaveDates).toEqual([tuesday]);
    expect(candidate!.reasonCodes).toContain("CONNECTS_COMPANY_HOLIDAY");
  });
});

describe("TEST 19: 대체공휴일", () => {
  it("휴식은 공휴일과 동일하게 계산하되 사유는 따로 남긴다", () => {
    const monday = findDayOfWeek(addDays(FIXTURE_ORIGIN, 7), MONDAY);
    const friday = addDays(monday, -3);
    const { candidates, index } = makeScenario({
      holidays: [substituteHoliday(monday, "테스트 대체공휴일")],
    });

    const day = index.dayAt(index.indexOf(monday))!;
    expect(day.scheduledWorkMinutes).toBe(0);
    expect(day.isSubstituteHoliday).toBe(true);

    const candidate = findFullDayCandidate(candidates, friday, monday);
    expect(candidate).toBeDefined();
    expect(candidate!.substituteHolidayDates).toEqual([monday]);
    expect(candidate!.publicHolidayDates).toEqual([]);
    expect(candidate!.reasonCodes).toContain("CONNECTS_SUBSTITUTE_HOLIDAY");
  });
});

describe("TEST 20: 공휴일 데이터 중복", () => {
  it("같은 날짜에 여러 레코드가 있어도 휴식일을 중복 계산하지 않는다", () => {
    const target = asLocalDate("2030-03-01");
    const merged = indexHolidays([
      { date: target, name: "삼일절", type: HolidayType.Public },
      { date: target, name: "삼일절", type: HolidayType.Public },
      { date: target, name: "임시공휴일", type: HolidayType.Substitute },
    ]);

    expect(merged.size).toBe(1);
    expect(merged.get(target)).toEqual({ name: "삼일절, 임시공휴일", isSubstitute: true });

    const { index } = makeScenario({
      from: asLocalDate("2030-02-20"),
      days: 20,
      holidays: [
        { date: target, name: "삼일절", type: HolidayType.Public },
        { date: target, name: "삼일절", type: HolidayType.Public },
      ],
    });

    const day = index.dayAt(index.indexOf(target))!;
    expect(day.scheduledWorkMinutes).toBe(0);
    expect(day.naturalRestMinutes).toBe(STANDARD_DAILY_MINUTES);
  });
});

describe("TEST 16: 안식휴가", () => {
  it("근무일 20일이 주말·공휴일을 건너 달력 기준으로 늘어난다", () => {
    const monday = findDayOfWeek(addDays(FIXTURE_ORIGIN, 7), MONDAY);

    const { candidates } = makeScenario({
      days: 120,
      annualLeaveDays: 0,
      includeSpecialLeave: true,
      extraLeaveTypes: [
        {
          id: "sabbatical",
          name: "안식휴가",
          category: LeaveCategory.Sabbatical,
          deductsFromAnnualLeave: false,
          durationBasis: LeaveDurationBasis.WorkingDay,
          durationDays: 20,
          canCombineWithAnnualLeave: false,
        },
      ],
    });

    const sabbatical = candidates.find(
      (candidate) =>
        candidate.leaveUsages.length === 20 &&
        candidate.leaveUsages.every((usage) => usage.leaveTypeId === "sabbatical") &&
        candidate.leaveUsages[0].date === monday,
    );

    expect(sabbatical).toBeDefined();
    // 근무일 20일 = 4주 → 그 사이 주말 8일이 자동으로 포함된다.
    expect(sabbatical!.leaveUsages).toHaveLength(20);
    // 시작 직전 주말(토·일)과 마지막 근무일 뒤 주말까지 흡수한다.
    expect(sabbatical!.consecutiveFullRestDays).toBeGreaterThanOrEqual(28);
    expect(sabbatical!.specialLeaveMinutesUsed).toBe(20 * STANDARD_DAILY_MINUTES);
    // 연차는 전혀 쓰지 않는다.
    expect(sabbatical!.annualLeaveMinutesUsed).toBe(0);
  });
});

describe("TEST 18: 연말 → 다음 해로 넘어가는 추천", () => {
  it("연도 경계를 넘는 구간도 정상적으로 계산된다", () => {
    const { candidates } = makeScenario({
      from: asLocalDate("2030-12-20"),
      days: 25,
      holidays: [holiday("2030-12-25", "성탄절"), holiday("2031-01-01", "신정")],
    });

    const crossYear = candidates.filter(
      (candidate) => candidate.startDate < "2031-01-01" && candidate.endDate >= "2031-01-01",
    );

    expect(crossYear.length).toBeGreaterThan(0);
    for (const candidate of crossYear) {
      expect(candidate.endDate > candidate.startDate).toBe(true);
      expect(candidate.consecutiveFullRestDays).toBeGreaterThan(0);
    }
  });
});
