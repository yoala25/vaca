import type { LocalDate } from "./local-date";

export const HolidayType = {
  Public: "PUBLIC",
  Substitute: "SUBSTITUTE",
} as const;
export type HolidayType = (typeof HolidayType)[keyof typeof HolidayType];

export interface Holiday {
  date: LocalDate;
  name: string;
  type: HolidayType;
}

/**
 * 해당 구간의 공휴일 데이터가 얼마나 확정적인지 (§32).
 * INCOMPLETE이면 UI가 "공휴일 확정 후 추천이 바뀔 수 있다"고 안내할 수 있다.
 */
export const HolidayDataStatus = {
  Official: "OFFICIAL",
  Estimated: "ESTIMATED",
  Incomplete: "INCOMPLETE",
} as const;
export type HolidayDataStatus = (typeof HolidayDataStatus)[keyof typeof HolidayDataStatus];

export interface HolidaySet {
  holidays: Holiday[];
  dataStatus: HolidayDataStatus;
  /** 데이터가 실제로 커버하는 구간. 요청 구간보다 좁으면 INCOMPLETE. */
  coveredFrom: LocalDate;
  coveredTo: LocalDate;
}

/**
 * 공휴일 데이터 공급 경계.
 * 엔진은 이 인터페이스만 알며, 외부 API를 직접 호출하지 않는다 (§30).
 * 운영: 공공데이터포털 API → 서버 캐시 → HolidayProvider → Engine
 * 테스트: MockHolidayProvider
 */
export interface HolidayProvider {
  getHolidays(startDate: LocalDate, endDate: LocalDate): Promise<HolidaySet>;
}

export interface CompanyHoliday {
  id: string;
  name: string;
  startDate: LocalDate;
  endDate: LocalDate;
  /** 매년 같은 월/일에 반복되는지(창립기념일 등). */
  recurring: boolean;
}
