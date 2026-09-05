import {
  HolidayDataStatus,
  HolidayType,
  asLocalDate,
  localDate,
  type Holiday,
  type HolidayProvider,
  type HolidaySet,
  type LocalDate,
} from "../domain/vacation";
import {
  FIRST_SUPPORTED_YEAR,
  LAST_SUPPORTED_YEAR,
  SUPPORTED_HOLIDAY_YEARS,
  getHolidaysForYear,
} from "./holidays";

/**
 * 공휴일 데이터 공급.
 *
 * 엔진은 HolidayProvider 인터페이스만 알고 데이터 출처는 모른다.
 * 지금은 정적 번들이지만, 백엔드가 생기면 이 모듈만 API 호출로 바꾸면 된다.
 * 커버 범위는 holidays.ts 의 데이터에서 자동으로 파생되므로,
 * 연도를 추가해도 이 파일은 손댈 필요가 없다.
 */

const COVERED_FROM: LocalDate = localDate(FIRST_SUPPORTED_YEAR, 1, 1);
const COVERED_TO: LocalDate = localDate(LAST_SUPPORTED_YEAR, 12, 31);

const ALL_HOLIDAYS: Holiday[] = SUPPORTED_HOLIDAY_YEARS.flatMap((year) =>
  getHolidaysForYear(year).map<Holiday>((holiday) => ({
    date: asLocalDate(holiday.date),
    name: holiday.name,
    type: holiday.substitute ? HolidayType.Substitute : HolidayType.Public,
  })),
).sort((a, b) => a.date.localeCompare(b.date));

export function getHolidaySet(startDate: LocalDate, endDate: LocalDate): HolidaySet {
  const holidays = ALL_HOLIDAYS.filter(
    (holiday) => holiday.date >= startDate && holiday.date <= endDate,
  );

  // 요청 구간이 번들 데이터 범위를 벗어나면 UI가 안내할 수 있도록 표시한다.
  const fullyCovered = startDate >= COVERED_FROM && endDate <= COVERED_TO;

  return {
    holidays,
    dataStatus: fullyCovered ? HolidayDataStatus.Official : HolidayDataStatus.Incomplete,
    coveredFrom: COVERED_FROM,
    coveredTo: COVERED_TO,
  };
}

export const staticHolidayProvider: HolidayProvider = {
  getHolidays: async (startDate, endDate) => getHolidaySet(startDate, endDate),
};
