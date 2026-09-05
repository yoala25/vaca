import type { CompanyHoliday, HolidayDataStatus, HolidaySet } from "./holiday";
import type { LeaveType } from "./leave-type";
import type { LocalDate } from "./local-date";
import type { WorkSchedule } from "./work-schedule";
import type { CandidateScoreBreakdown, VacationCandidate } from "./vacation-candidate";

export const VacationStrategy = {
  LongBreak: "LONG_BREAK",
  FrequentBreaks: "FREQUENT_BREAKS",
  LeaveSaving: "LEAVE_SAVING",
  Balanced: "BALANCED",
} as const;
export type VacationStrategy = (typeof VacationStrategy)[keyof typeof VacationStrategy];

export interface DateRange {
  startDate: LocalDate;
  endDate: LocalDate;
}

export const SeasonPreference = {
  Spring: "SPRING",
  Summer: "SUMMER",
  Autumn: "AUTUMN",
  YearEnd: "YEAR_END",
} as const;
export type SeasonPreference = (typeof SeasonPreference)[keyof typeof SeasonPreference];

export interface VacationPreferences {
  preferredSeasons?: SeasonPreference[];
  /** 사용자가 휴가를 쓸 수 없다고 지정한 날짜. */
  blockedDates?: LocalDate[];
}

export interface ScoredCandidate {
  candidate: VacationCandidate;
  score: number;
  breakdown: CandidateScoreBreakdown;
}

export interface VacationPortfolio {
  strategy: VacationStrategy;
  selectedCandidates: VacationCandidate[];
  totalAnnualLeaveMinutesUsed: number;
  totalRestMinutes: number;
  /** 중복 없이 센 총 휴식일. */
  totalDistinctRestDays: number;
  portfolioEfficiency: number;
  remainingLeaveMinutes: number;
  score: number;
}

export interface VacationOverlayRange {
  candidateId: string;
  startDate: LocalDate;
  endDate: LocalDate;
  /** 하루 전체 휴가를 쓴 날. */
  leaveDates: LocalDate[];
  /** 반차/시간차를 쓴 날. */
  partialLeaveDates: {
    date: LocalDate;
    minutes: number;
    period: "AM" | "PM" | "START" | "END";
  }[];
  weekendDates: LocalDate[];
  publicHolidayDates: LocalDate[];
  substituteHolidayDates: LocalDate[];
  companyHolidayDates: LocalDate[];
  totalRestDays: number;
  totalRestMinutes: number;
  leaveUsedMinutes: number;
  leaveUsedDays: number;
  /**
   * 연차가 아니라 별도 부여 휴가(리프레시·안식휴가)로 쓴 일수.
   * 0보다 크면 이 구간은 연차를 축내지 않는다 — UI가 "연차 10일"이라고
   * 잘못 표시하지 않도록 구분해서 내려준다.
   */
  specialLeaveUsedDays: number;
  /** 쓴 특별휴가 이름(있을 때만). */
  specialLeaveName?: string;
  efficiency: number;
  label: string;
  emoji: string;
  headline: string;
  description: string;
}

export interface CalendarOverlay {
  strategy: VacationStrategy;
  ranges: VacationOverlayRange[];
}

export interface VacationEngineInput {
  dateRange: DateRange;
  workSchedule: WorkSchedule;
  holidays: HolidaySet;
  companyHolidays: CompanyHoliday[];
  leaveCatalog: LeaveType[];
  strategy: VacationStrategy;
  preferences?: VacationPreferences;
  /** 안식/리프레시 등 장기 특별휴가 후보까지 생성할지. MVP 기본값 false. */
  includeSpecialLeave?: boolean;
  /**
   * 반차·시간차 후보를 추천 포트폴리오에 포함할지. MVP 기본값 false.
   * 후보 생성·평가는 항상 수행되며, 이 플래그는 "대표 추천으로 보여줄지"만 결정한다.
   */
  includePartialLeaveInPortfolio?: boolean;
}

export interface VacationOptimizationResult {
  strategy: VacationStrategy;
  bestCandidate?: VacationCandidate;
  rankedCandidates: ScoredCandidate[];
  portfolio: VacationPortfolio;
  calendarOverlay: CalendarOverlay;
  summary: {
    remainingLeaveMinutes: number;
    leaveMinutesUsed: number;
    leaveDaysUsed: number;
    totalRestDays: number;
    efficiency: number;
    holidayDataStatus: HolidayDataStatus;
  };
}
