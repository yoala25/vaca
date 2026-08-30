import {
  HolidayDataStatus,
  HolidayType,
  asLocalDate,
  type Holiday,
  type HolidayProvider,
  type HolidaySet,
  type LocalDate,
} from "../domain/vacation";
import { KR_HOLIDAYS } from "./holidays";

/** 정적 번들 데이터가 실제로 커버하는 구간. */
const COVERED_FROM = asLocalDate("2026-01-01");
const COVERED_TO = asLocalDate("2027-12-31");

function toHoliday(date: LocalDate, name: string): Holiday {
  return {
    date,
    name,
    // 이름에 "대체공휴일"이 들어가면 대체공휴일로 분류한다.
    type: name.includes("대체공휴일") ? HolidayType.Substitute : HolidayType.Public,
  };
}

const ALL_HOLIDAYS: Holiday[] = Object.entries(KR_HOLIDAYS)
  .map(([date, name]) => toHoliday(asLocalDate(date), name))
  .sort((a, b) => a.date.localeCompare(b.date));

/**
 * 요청 구간의 공휴일을 동기적으로 돌려준다.
 *
 * 엔진은 HolidayProvider 인터페이스만 알고 데이터 출처는 모른다(§30).
 * 지금은 정적 번들이지만, 백엔드가 생기면 이 모듈만 공공데이터포털 API 호출로 바꾸면 된다.
 */
export function getHolidaySet(startDate: LocalDate, endDate: LocalDate): HolidaySet {
  const holidays = ALL_HOLIDAYS.filter(
    (holiday) => holiday.date >= startDate && holiday.date <= endDate,
  );

  // 요청 구간이 번들 데이터 범위를 벗어나면 UI가 안내할 수 있도록 표시한다 (§32).
  const fullyCovered = startDate >= COVERED_FROM && endDate <= COVERED_TO;

  return {
    holidays,
    dataStatus: fullyCovered ? HolidayDataStatus.Official : HolidayDataStatus.Incomplete,
    coveredFrom: COVERED_FROM,
    coveredTo: COVERED_TO,
  };
}

/** 비동기 경계가 필요할 때(서버 연동 시) 쓰는 구현체. */
export const staticHolidayProvider: HolidayProvider = {
  getHolidays: async (startDate, endDate) => getHolidaySet(startDate, endDate),
};
