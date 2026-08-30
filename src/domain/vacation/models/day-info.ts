import type { DayOfWeek, LocalDate } from "./local-date";

/**
 * 달력 위 하루를 완전히 정규화한 값.
 * 이후 모든 계산(후보 생성/평가/최적화)은 오직 DayInfo[]만 본다.
 */
export interface DayInfo {
  date: LocalDate;

  year: number;
  month: number;
  day: number;
  dayOfWeek: DayOfWeek;

  isWeekend: boolean;

  isPublicHoliday: boolean;
  publicHolidayName?: string;
  /** 대체공휴일 여부. 휴식 계산에서는 공휴일과 동일하게 취급하되 사유는 구분한다. */
  isSubstituteHoliday: boolean;

  isCompanyHoliday: boolean;
  companyHolidayName?: string;

  /** 사용자가 "이 날은 휴가 못 씀"으로 지정한 날 (§40). */
  isUserBlockedDate: boolean;

  /** 실제로 출근해야 하는 날인지 = scheduledWorkMinutes > 0 */
  isScheduledWorkday: boolean;

  /**
   * 주말·공휴일·회사휴무를 반영한 뒤, 그 날 실제로 근무해야 하는 분.
   * 이 값이 곧 "쉬려면 휴가로 메워야 하는 분"이다.
   */
  scheduledWorkMinutes: number;

  /** scheduledWorkMinutes와 동일 의미의 별칭(스펙 호환). */
  mandatoryWorkMinutes: number;

  /** 근무 로스터상으로는 일해야 했지만 자연 휴일 덕분에 면제된 분. */
  naturalRestMinutes: number;

  /** 공휴일/회사휴무를 무시한 순수 근무 로스터 기준 근무 분. */
  rosterWorkMinutes: number;
}

/** 주말·공휴일·대체공휴일·회사휴무 = 휴가를 쓰지 않아도 쉬는 날. */
export function isNaturalRestDay(day: DayInfo): boolean {
  return day.scheduledWorkMinutes === 0;
}

/** 쉬려면 반드시 휴가를 써야 하는 날. */
export function requiresLeaveToRest(day: DayInfo): boolean {
  return day.scheduledWorkMinutes > 0;
}
