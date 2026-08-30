import { describe, expect, it } from "vitest";
import {
  DayOfWeek,
  addDays,
  asLocalDate,
  civilFromDays,
  dayOfWeek,
  daysFromCivil,
  differenceInDays,
  differenceInMinutes,
  eachDayInRange,
  inclusiveDayCount,
  isWeekend,
  localDate,
  monthKey,
  timeFromMinutes,
  toEpochDay,
  todayInSeoul,
} from "../models/local-date";
import { createWorkSchedule, timeAfterWorkedMinutes } from "../models/work-schedule";

describe("LocalDate 기본 연산", () => {
  it("civil ↔ epoch day 왕복이 정확하다", () => {
    const samples = [
      [1970, 1, 1],
      [2000, 2, 29],
      [2024, 2, 29],
      [2026, 9, 25],
      [2030, 12, 31],
      [2100, 3, 1],
    ] as const;

    for (const [year, month, day] of samples) {
      const epoch = daysFromCivil(year, month, day);
      expect(civilFromDays(epoch)).toEqual({ year, month, day });
    }
  });

  it("1970-01-01은 목요일이다", () => {
    expect(toEpochDay(asLocalDate("1970-01-01"))).toBe(0);
    expect(dayOfWeek(asLocalDate("1970-01-01"))).toBe(DayOfWeek.Thursday);
  });

  it("윤년 경계를 정확히 넘는다", () => {
    expect(addDays(asLocalDate("2024-02-28"), 1)).toBe("2024-02-29");
    expect(addDays(asLocalDate("2024-02-29"), 1)).toBe("2024-03-01");
    expect(addDays(asLocalDate("2023-02-28"), 1)).toBe("2023-03-01");
  });

  it("존재하지 않는 날짜를 거부한다", () => {
    expect(() => localDate(2023, 2, 29)).toThrow();
    expect(() => asLocalDate("2023-13-01")).toThrow();
    expect(() => asLocalDate("2023-1-1")).toThrow();
  });

  it("날짜 차이와 일수 계산이 맞다", () => {
    expect(differenceInDays(asLocalDate("2030-01-01"), asLocalDate("2030-01-10"))).toBe(9);
    expect(inclusiveDayCount(asLocalDate("2030-01-01"), asLocalDate("2030-01-10"))).toBe(10);
    expect(eachDayInRange(asLocalDate("2030-01-01"), asLocalDate("2030-01-03"))).toEqual([
      "2030-01-01",
      "2030-01-02",
      "2030-01-03",
    ]);
  });

  it("monthKey를 뽑는다", () => {
    expect(monthKey(asLocalDate("2026-09-25"))).toBe("2026-09");
  });
});

/** TEST 17 — 타임존이 달라도 날짜가 하루 밀리지 않아야 한다. */
describe("TEST 17: 타임존 안정성", () => {
  it("날짜 연산이 JS Date/UTC 변환에 전혀 의존하지 않는다", () => {
    // Date 객체를 경유했다면 UTC-9 환경에서 하루 밀렸을 값들.
    expect(addDays(asLocalDate("2026-09-25"), 1)).toBe("2026-09-26");
    expect(dayOfWeek(asLocalDate("2026-09-25"))).toBe(DayOfWeek.Friday);
    expect(isWeekend(asLocalDate("2026-09-26"))).toBe(true);
  });

  it("프로세스 타임존을 UTC로 바꿔도 결과가 같다", () => {
    const original = process.env.TZ;
    const readAll = () => ({
      shifted: addDays(asLocalDate("2026-01-01"), -1),
      dow: dayOfWeek(asLocalDate("2026-01-01")),
      epoch: toEpochDay(asLocalDate("2026-01-01")),
    });

    process.env.TZ = "UTC";
    const utc = readAll();
    process.env.TZ = "Pacific/Kiritimati"; // UTC+14
    const plus14 = readAll();
    process.env.TZ = "Pacific/Midway"; // UTC-11
    const minus11 = readAll();
    process.env.TZ = original;

    expect(utc).toEqual(plus14);
    expect(utc).toEqual(minus11);
    expect(utc.shifted).toBe("2025-12-31");
  });

  it("todayInSeoul은 항상 Asia/Seoul 기준 날짜를 준다", () => {
    // UTC 15:00 = 서울 익일 00:00
    const instant = new Date("2026-09-24T15:00:00Z");
    expect(todayInSeoul(instant)).toBe("2026-09-25");
  });
});

describe("근무 시각 계산", () => {
  const schedule = createWorkSchedule({
    startTime: "09:00",
    endTime: "18:00",
    breakPeriods: [{ start: "12:00", end: "13:00" }],
  });

  it("점심 휴게를 제외하고 하루 480분을 계산한다", () => {
    expect(schedule.defaultDailyWorkMinutes).toBe(480);
  });

  it("휴게시간을 건너뛰며 근무 경과 시각을 구한다", () => {
    expect(timeAfterWorkedMinutes(schedule, 0)).toBe("09:00");
    expect(timeAfterWorkedMinutes(schedule, 180)).toBe("12:00");
    expect(timeAfterWorkedMinutes(schedule, 181)).toBe("13:01");
    expect(timeAfterWorkedMinutes(schedule, 360)).toBe("16:00");
    expect(timeAfterWorkedMinutes(schedule, 480)).toBe("18:00");
  });

  it("반차 경계는 점심 휴게 종료 시각을 기본값으로 쓴다", () => {
    expect(schedule.halfDayBoundaryTime).toBe("13:00");
  });

  it("분 단위 시각 변환이 맞다", () => {
    expect(timeFromMinutes(0)).toBe("00:00");
    expect(timeFromMinutes(9 * 60 + 30)).toBe("09:30");
  });

  it("날짜를 넘는 분 차이를 계산한다", () => {
    const minutes = differenceInMinutes(
      "2030-01-01T18:00" as never,
      "2030-01-04T09:00" as never,
    );
    expect(minutes).toBe(3 * 1440 - 9 * 60);
  });
});
