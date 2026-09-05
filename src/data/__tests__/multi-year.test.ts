import { describe, expect, it } from "vitest";
import {
  FIRST_SUPPORTED_YEAR,
  LAST_SUPPORTED_YEAR,
  SUPPORTED_HOLIDAY_YEARS,
  getHolidaysForYear,
  hasHolidayData,
  holidayName,
} from "../holidays";
import { getHolidaySet } from "../holidayProvider";
import {
  entryTypeFor,
  getLeaveDays,
  sanitizeWallet,
  setLeaveDays,
  type LeaveWallet,
} from "../leaveWallet";
import { sanitizeLeaveDays, sanitizeYear } from "../../lib/validation";
import { HolidayDataStatus, localDate } from "../../domain/vacation";

const CURRENT_YEAR = 2026;

describe("CASE 1 · 2026년 연차 4일 입력", () => {
  it("올해 값은 '남은 연차'로 저장되고 그대로 읽힌다", () => {
    const wallet = setLeaveDays({}, 2026, 4, CURRENT_YEAR);
    expect(getLeaveDays(wallet, 2026)).toBe(4);
    expect(wallet[2026].type).toBe("remaining");
  });

  it("2026년을 채워도 미래 연도로 복사되지 않는다", () => {
    const wallet = setLeaveDays({}, 2026, 4, CURRENT_YEAR);
    expect(getLeaveDays(wallet, 2027)).toBeUndefined();
    expect(getLeaveDays(wallet, 2028)).toBeUndefined();
  });
});

describe("CASE 2 · 2027년 최초 진입 후 15일 입력", () => {
  it("입력 전에는 값이 없어 입력 UI가 필요한 상태다", () => {
    const wallet = setLeaveDays({}, 2026, 4, CURRENT_YEAR);
    expect(getLeaveDays(wallet, 2027)).toBeUndefined();
  });

  it("입력하면 '예상 연차'로 저장된다", () => {
    let wallet = setLeaveDays({}, 2026, 4, CURRENT_YEAR);
    wallet = setLeaveDays(wallet, 2027, 15, CURRENT_YEAR);
    expect(getLeaveDays(wallet, 2027)).toBe(15);
    expect(wallet[2027].type).toBe("expected");
    expect(entryTypeFor(2027, CURRENT_YEAR)).toBe("expected");
  });

  it("2027년 예산으로 실제 추천이 나온다", () => {
    const range = { startDate: localDate(2027, 1, 1), endDate: localDate(2027, 12, 31) };
    const set = getHolidaySet(range.startDate, range.endDate);
    expect(set.holidays.length).toBeGreaterThan(10);
    expect(set.dataStatus).toBe(HolidayDataStatus.Official);
  });
});

describe("CASE 3 · 2027년 15일 → 10일 재계산", () => {
  it("같은 연도 값만 바뀌고 다른 연도는 그대로다", () => {
    let wallet: LeaveWallet = {};
    wallet = setLeaveDays(wallet, 2026, 4, CURRENT_YEAR);
    wallet = setLeaveDays(wallet, 2027, 15, CURRENT_YEAR);
    wallet = setLeaveDays(wallet, 2028, 20, CURRENT_YEAR);

    wallet = setLeaveDays(wallet, 2027, 10, CURRENT_YEAR);

    expect(getLeaveDays(wallet, 2027)).toBe(10);
    expect(getLeaveDays(wallet, 2026)).toBe(4);
    expect(getLeaveDays(wallet, 2028)).toBe(20);
  });
});

describe("CASE 4 · 2026 / 2027 / 2028 독립성", () => {
  it("세 연도가 서로 다른 값을 유지한다", () => {
    let wallet: LeaveWallet = {};
    wallet = setLeaveDays(wallet, 2026, 4, CURRENT_YEAR);
    wallet = setLeaveDays(wallet, 2027, 15, CURRENT_YEAR);
    wallet = setLeaveDays(wallet, 2028, 20, CURRENT_YEAR);
    expect([2026, 2027, 2028].map((y) => getLeaveDays(wallet, y))).toEqual([4, 15, 20]);
  });

  it("값이 없는 연도는 다른 연도 값으로 대체되지 않는다", () => {
    const wallet = setLeaveDays({}, 2027, 15, CURRENT_YEAR);
    expect(getLeaveDays(wallet, 2026)).toBeUndefined();
    expect(getLeaveDays(wallet, 2028)).toBeUndefined();
  });

  it("연도마다 공휴일이 다르다", () => {
    const seollal = [2026, 2027, 2028].map(
      (year) => getHolidaysForYear(year).find((h) => h.name === "설날")?.date,
    );
    expect(seollal).toEqual(["2026-02-17", "2027-02-07", "2028-01-27"]);
  });
});

describe("CASE 5 · 연도 전환 왕복", () => {
  it("2026 → 2027 → 2026 을 돌아도 값이 보존된다", () => {
    let wallet: LeaveWallet = {};
    wallet = setLeaveDays(wallet, 2026, 4, CURRENT_YEAR);
    wallet = setLeaveDays(wallet, 2027, 15, CURRENT_YEAR);
    // 연도 전환은 지갑을 건드리지 않는다.
    const years = [2026, 2027, 2026];
    for (const year of years) {
      expect(sanitizeYear(year, [2026, 2027, 2028], CURRENT_YEAR)).toBe(year);
    }
    expect(getLeaveDays(wallet, 2026)).toBe(4);
    expect(getLeaveDays(wallet, 2027)).toBe(15);
  });
});

describe("CASE 6 · 새로고침(저장/복원)", () => {
  it("직렬화 후 복원해도 연도별 값과 타입이 유지된다", () => {
    let wallet: LeaveWallet = {};
    wallet = setLeaveDays(wallet, 2026, 4, CURRENT_YEAR);
    wallet = setLeaveDays(wallet, 2027, 15, CURRENT_YEAR);

    const restored = sanitizeWallet(JSON.parse(JSON.stringify(wallet)), CURRENT_YEAR);
    expect(getLeaveDays(restored, 2026)).toBe(4);
    expect(getLeaveDays(restored, 2027)).toBe(15);
    expect(restored[2027].type).toBe("expected");
  });

  it("구버전(지갑 없음) 저장값도 깨지지 않는다", () => {
    expect(sanitizeWallet(undefined, CURRENT_YEAR)).toEqual({});
    expect(sanitizeWallet(null, CURRENT_YEAR)).toEqual({});
    expect(sanitizeWallet("nope", CURRENT_YEAR)).toEqual({});
  });

  it("오염된 저장값은 버리거나 안전한 값으로 고친다", () => {
    const dirty = {
      "2027": { days: 999999, type: "admin" },
      "-1": { days: 5, type: "remaining" },
      abc: { days: 5, type: "remaining" },
      "2028": { days: "<script>alert(1)</script>", type: "expected" },
    };
    const clean = sanitizeWallet(dirty, CURRENT_YEAR);
    expect(getLeaveDays(clean, 2027)).toBeLessThanOrEqual(90);
    expect(clean[2027].type).toBe("expected"); // 저장된 문자열이 아니라 연도로 재계산
    expect(clean[-1]).toBeUndefined();
    expect(Object.keys(clean).every((key) => Number(key) >= 1970)).toBe(true);
    expect(getLeaveDays(clean, 2028) ?? 0).toBe(0);
  });
});

describe("CASE 7 · 2027년 공휴일 정확도", () => {
  const expected: Array<[string, string]> = [
    ["2027-01-01", "신정"],
    ["2027-02-07", "설날"],
    ["2027-02-09", "설날 대체공휴일"],
    ["2027-03-01", "삼일절"],
    ["2027-05-05", "어린이날"],
    ["2027-05-13", "부처님오신날"],
    ["2027-06-06", "현충일"],
    ["2027-08-15", "광복절"],
    ["2027-08-16", "광복절 대체공휴일"],
    ["2027-09-15", "추석"],
    ["2027-10-03", "개천절"],
    ["2027-10-09", "한글날"],
    ["2027-12-25", "성탄절"],
  ];

  it.each(expected)("%s 은 %s", (date, name) => {
    expect(holidayName(date)).toBe(name);
  });

  it("근로자의 날·제헌절은 공휴일이 아니다", () => {
    expect(holidayName("2027-05-01")).toBeUndefined();
    expect(holidayName("2027-07-17")).toBeUndefined();
  });
});

describe("연도 지원 범위", () => {
  it("지원 연도는 데이터에서 파생된다", () => {
    expect(SUPPORTED_HOLIDAY_YEARS).toEqual([2026, 2027, 2028]);
    expect(FIRST_SUPPORTED_YEAR).toBe(2026);
    expect(LAST_SUPPORTED_YEAR).toBe(2028);
    expect(hasHolidayData(2029)).toBe(false);
  });

  it("데이터 범위를 벗어난 구간은 Incomplete 로 표시된다", () => {
    const set = getHolidaySet(localDate(2029, 1, 1), localDate(2029, 12, 31));
    expect(set.dataStatus).toBe(HolidayDataStatus.Incomplete);
    expect(set.holidays).toEqual([]);
  });
});

describe("입력 방어", () => {
  it("연차 일수는 0~90 으로 정규화된다", () => {
    expect(sanitizeLeaveDays(-10)).toBe(0);
    expect(sanitizeLeaveDays(999999)).toBe(90);
    expect(sanitizeLeaveDays("15")).toBe(15);
    expect(sanitizeLeaveDays("<script>alert(1)</script>")).toBe(0);
    expect(sanitizeLeaveDays(Number.NaN)).toBe(0);
    // Infinity 는 정상 입력이 아니므로 상한이 아니라 안전한 기본값으로 되돌린다.
    expect(sanitizeLeaveDays(Number.POSITIVE_INFINITY)).toBe(0);
    expect(sanitizeLeaveDays(3.7)).toBe(3.5);
  });

  it("연도는 허용 목록 안으로만 들어온다", () => {
    const allowed = [2026, 2027, 2028];
    expect(sanitizeYear(-1, allowed, 2026)).toBe(2026);
    expect(sanitizeYear(999999, allowed, 2026)).toBe(2026);
    expect(sanitizeYear("<script>", allowed, 2026)).toBe(2026);
    expect(sanitizeYear("2027", allowed, 2026)).toBe(2027);
    expect(sanitizeYear(2099, allowed, 2026)).toBe(2026);
  });
});
