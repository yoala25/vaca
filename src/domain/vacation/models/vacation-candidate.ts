import type { LeaveUsage } from "./leave-type";
import { inclusiveDayCount, maxDate, minDate, type LocalDate, type LocalDateTime } from "./local-date";

export type VacationReasonCode =
  | "CONNECTS_WEEKEND"
  | "CONNECTS_PUBLIC_HOLIDAY"
  | "CONNECTS_SUBSTITUTE_HOLIDAY"
  | "CONNECTS_COMPANY_HOLIDAY"
  | "HIGH_EFFICIENCY"
  | "LONG_CONSECUTIVE_BREAK"
  | "USES_MINIMAL_ANNUAL_LEAVE"
  | "SPREADS_BREAKS_EVENLY"
  | "GOOD_FOR_TRAVEL"
  | "USES_PARTIAL_LEAVE"
  | "EXTENDS_WEEKEND"
  | "USES_SABBATICAL_EFFICIENTLY";

export const TravelSuitability = {
  None: "NONE",
  ShortTrip: "SHORT_TRIP",
  RegionalTravel: "REGIONAL_TRAVEL",
  LongTravel: "LONG_TRAVEL",
} as const;
export type TravelSuitability = (typeof TravelSuitability)[keyof typeof TravelSuitability];

/** 반차·시간차 후보 전용 지표 (§14). */
export interface PartialRestMetrics {
  continuousRestMinutes: number;
  /** 부분휴가를 쓰지 않았을 때 대비 늘어난 휴식 분. */
  extensionMinutesComparedToNormal: number;
  leaveMinutesSpent: number;
  /** 늘어난 휴식 분 / 사용한 휴가 분. */
  extensionEfficiency: number;
}

export interface CandidateScoreBreakdown {
  baseScore: number;
  durationScore: number;
  efficiencyScore: number;
  spacingScore: number;
  preferenceScore: number;
  holidayConnectionBonus: number;
  penalties: { reason: string; value: number }[];
  finalScore: number;
}

export interface VacationCandidate {
  id: string;

  /** 완전히 쉬는 날들의 시작/끝(부분휴가일은 포함하지 않는다). */
  startDate: LocalDate;
  endDate: LocalDate;

  /** 부분휴가를 반영한 실제 연속 휴식 시작/종료 시각. */
  restStartDateTime: LocalDateTime;
  restEndDateTime: LocalDateTime;

  /** startDate~endDate의 달력 일수. */
  totalCalendarDays: number;
  /** restStartDateTime~restEndDateTime의 총 분. */
  totalRestMinutes: number;
  /** 하루 종일 완전히 쉬는 날 수. */
  consecutiveFullRestDays: number;

  annualLeaveMinutesUsed: number;
  hourlyLeaveMinutesUsed: number;
  specialLeaveMinutesUsed: number;
  /** 연차 잔여에서 실제로 차감되는 총 분. */
  totalLeaveMinutesUsed: number;
  /** totalLeaveMinutesUsed를 표준 근무일 기준 일수로 환산한 값. */
  annualLeaveEquivalentDays: number;

  leaveUsages: LeaveUsage[];
  /** 휴가를 쓴 날짜(부분휴가일 포함). */
  leaveDates: LocalDate[];

  weekendDates: LocalDate[];
  publicHolidayDates: LocalDate[];
  substituteHolidayDates: LocalDate[];
  companyHolidayDates: LocalDate[];

  /** consecutiveFullRestDays / annualLeaveEquivalentDays. */
  efficiencyScore: number;

  partialMetrics?: PartialRestMetrics;

  reasonCodes: VacationReasonCode[];
  travelSuitability: TravelSuitability;

  metadata: Record<string, unknown>;
}

export function hasCandidateOverlap(a: VacationCandidate, b: VacationCandidate): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

/** 두 후보가 겹치는 날 수. */
export function candidateOverlapDays(a: VacationCandidate, b: VacationCandidate): number {
  const start = maxDate(a.startDate, b.startDate);
  const end = minDate(a.endDate, b.endDate);
  if (start > end) return 0;
  return inclusiveDayCount(start, end);
}

/**
 * 두 후보가 실질적으로 같은 연휴를 가리키는 정도 (0~1). Jaccard 지수.
 *
 * 짧은 쪽을 분모로 쓰면 안 된다. 긴 후보 안에 완전히 들어가는 짧은 후보가 무조건 1이 되어
 * "연차 1일짜리"와 "연차 5일짜리"가 같은 후보로 묶여버리기 때문이다.
 * 합집합을 분모로 써야 "9/20~9/28 vs 9/21~9/28"처럼 사실상 동일한 구간만 묶인다.
 */
export function candidateOverlapRatio(a: VacationCandidate, b: VacationCandidate): number {
  const intersection = candidateOverlapDays(a, b);
  if (intersection === 0) return 0;
  const union = a.totalCalendarDays + b.totalCalendarDays - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** 두 후보가 실제로 휴가를 쓰는 날짜가 얼마나 같은가 (0~1). Jaccard 지수. */
export function leaveDateSimilarity(a: VacationCandidate, b: VacationCandidate): number {
  const left = new Set(a.leaveDates);
  const right = new Set(b.leaveDates);
  if (left.size === 0 && right.size === 0) return 1;

  let intersection = 0;
  for (const date of left) {
    if (right.has(date)) intersection++;
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
