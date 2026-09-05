/**
 * 대한민국 법정공휴일 (대체공휴일 포함) — 연도별 구조.
 *
 * ── 연도를 추가하는 방법 ──
 * HOLIDAYS_BY_YEAR 에 연도 키 하나를 추가하면 끝난다.
 * 앱이 지원하는 연도 목록(SUPPORTED_HOLIDAY_YEARS)과 데이터 커버리지는
 * 이 객체에서 자동으로 파생되므로 다른 파일은 손댈 필요가 없다.
 *
 * ── 왜 계산이 아니라 데이터인가 ──
 * 설날·추석·부처님오신날은 음력 기반이라 양력 날짜를 규칙으로 계산할 수 없다.
 * 대체공휴일도 "개천절이 추석과 겹쳐 하루 밀리는" 식의 예외가 있어(2028년 10/5)
 * 규칙만으로 재현하면 틀리기 쉽다. 정부가 매년 관보로 확정 발표하므로
 * 확정된 값을 데이터로 두고, 연도별로 갱신하는 편이 정확하다.
 *
 * 노동절(근로자의 날)과 제헌절은 관공서 공휴일이 아니므로 제외한다.
 */

export interface HolidayRecord {
  /** MM-DD */
  monthDay: string;
  name: string;
  /** 대체공휴일 여부 */
  substitute?: boolean;
}

const HOLIDAYS_BY_YEAR: Record<number, HolidayRecord[]> = {
  2026: [
    { monthDay: "01-01", name: "신정" },
    { monthDay: "02-16", name: "설날 연휴" },
    { monthDay: "02-17", name: "설날" },
    { monthDay: "02-18", name: "설날 연휴" },
    { monthDay: "03-01", name: "삼일절" },
    { monthDay: "03-02", name: "삼일절 대체공휴일", substitute: true },
    { monthDay: "05-05", name: "어린이날" },
    { monthDay: "05-24", name: "부처님오신날" },
    { monthDay: "05-25", name: "부처님오신날 대체공휴일", substitute: true },
    { monthDay: "06-06", name: "현충일" },
    { monthDay: "08-15", name: "광복절" },
    { monthDay: "08-17", name: "광복절 대체공휴일", substitute: true },
    { monthDay: "09-24", name: "추석 연휴" },
    { monthDay: "09-25", name: "추석" },
    { monthDay: "09-26", name: "추석 연휴" },
    { monthDay: "10-03", name: "개천절" },
    { monthDay: "10-05", name: "개천절 대체공휴일", substitute: true },
    { monthDay: "10-09", name: "한글날" },
    { monthDay: "12-25", name: "성탄절" },
  ],
  2027: [
    { monthDay: "01-01", name: "신정" },
    { monthDay: "02-06", name: "설날 연휴" },
    { monthDay: "02-07", name: "설날" },
    { monthDay: "02-08", name: "설날 연휴" },
    { monthDay: "02-09", name: "설날 대체공휴일", substitute: true },
    { monthDay: "03-01", name: "삼일절" },
    { monthDay: "05-05", name: "어린이날" },
    { monthDay: "05-13", name: "부처님오신날" },
    { monthDay: "06-06", name: "현충일" },
    { monthDay: "08-15", name: "광복절" },
    { monthDay: "08-16", name: "광복절 대체공휴일", substitute: true },
    { monthDay: "09-14", name: "추석 연휴" },
    { monthDay: "09-15", name: "추석" },
    { monthDay: "09-16", name: "추석 연휴" },
    { monthDay: "10-03", name: "개천절" },
    { monthDay: "10-04", name: "개천절 대체공휴일", substitute: true },
    { monthDay: "10-09", name: "한글날" },
    { monthDay: "10-11", name: "한글날 대체공휴일", substitute: true },
    { monthDay: "12-25", name: "성탄절" },
    { monthDay: "12-27", name: "성탄절 대체공휴일", substitute: true },
  ],
  2028: [
    { monthDay: "01-01", name: "신정" },
    { monthDay: "01-26", name: "설날 연휴" },
    { monthDay: "01-27", name: "설날" },
    { monthDay: "01-28", name: "설날 연휴" },
    { monthDay: "03-01", name: "삼일절" },
    { monthDay: "05-02", name: "부처님오신날" },
    { monthDay: "05-05", name: "어린이날" },
    { monthDay: "06-06", name: "현충일" },
    { monthDay: "08-15", name: "광복절" },
    { monthDay: "10-02", name: "추석 연휴" },
    { monthDay: "10-03", name: "추석·개천절" },
    { monthDay: "10-04", name: "추석 연휴" },
    // 개천절이 추석과 겹쳐 하루 밀린 대체공휴일
    { monthDay: "10-05", name: "개천절 대체공휴일", substitute: true },
    { monthDay: "10-09", name: "한글날" },
    { monthDay: "12-25", name: "성탄절" },
  ],
};

/** 공휴일 데이터가 있는 연도 목록(오름차순). */
export const SUPPORTED_HOLIDAY_YEARS: number[] = Object.keys(HOLIDAYS_BY_YEAR)
  .map(Number)
  .sort((a, b) => a - b);

export const FIRST_SUPPORTED_YEAR = SUPPORTED_HOLIDAY_YEARS[0];
export const LAST_SUPPORTED_YEAR = SUPPORTED_HOLIDAY_YEARS[SUPPORTED_HOLIDAY_YEARS.length - 1];

export function hasHolidayData(year: number): boolean {
  return year in HOLIDAYS_BY_YEAR;
}

export interface ResolvedHoliday {
  date: string;
  name: string;
  substitute: boolean;
}

/** 해당 연도의 공휴일. 데이터가 없으면 빈 배열. */
export function getHolidaysForYear(year: number): ResolvedHoliday[] {
  const records = HOLIDAYS_BY_YEAR[year];
  if (!records) return [];
  return records.map((record) => ({
    date: `${year}-${record.monthDay}`,
    name: record.name,
    substitute: record.substitute === true,
  }));
}

/** 날짜 → 이름 조회용 평면 맵(모든 연도). */
const FLAT_HOLIDAYS: Record<string, string> = Object.fromEntries(
  SUPPORTED_HOLIDAY_YEARS.flatMap((year) =>
    getHolidaysForYear(year).map((holiday) => [holiday.date, holiday.name]),
  ),
);

/** 기존 호출부 호환용. 날짜별 공휴일 이름 맵. */
export const KR_HOLIDAYS: Record<string, string> = FLAT_HOLIDAYS;

export function isHoliday(dateKey: string): boolean {
  return dateKey in FLAT_HOLIDAYS;
}

export function holidayName(dateKey: string): string | undefined {
  return FLAT_HOLIDAYS[dateKey];
}
