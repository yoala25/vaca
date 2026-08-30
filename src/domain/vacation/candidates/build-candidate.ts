import type { CalendarIndex } from "../calendar/calendar-index";
import type { DayInfo } from "../models/day-info";
import { LeaveCategory, type LeaveType, type LeaveUsage } from "../models/leave-type";
import {
  atTime,
  differenceInMinutes,
  endOfDay,
  inclusiveDayCount,
  startOfDay,
  type LocalDate,
  type LocalDateTime,
} from "../models/local-date";
import {
  TravelSuitability,
  type PartialRestMetrics,
  type VacationCandidate,
  type VacationReasonCode,
} from "../models/vacation-candidate";
import { workEndTime, type WorkSchedule } from "../models/work-schedule";

const HIGH_EFFICIENCY_THRESHOLD = 3;
const LONG_BREAK_THRESHOLD_DAYS = 7;
const MINIMAL_LEAVE_THRESHOLD_DAYS = 1;

export interface BuildCandidateParams {
  index: CalendarIndex;
  schedule: WorkSchedule;
  leaveCatalog: LeaveType[];
  /** 하루 종일 쉬는 구간(부분휴가일은 포함하지 않는다). */
  coreStartIndex: number;
  coreEndIndex: number;
  /** 코어 내부의 근무일에 사용하는 종일 휴가. */
  fullDayUsages: LeaveUsage[];
  /** 코어 시작 직전 근무일에 붙이는 부분휴가(조퇴). */
  leadingPartialUsage?: LeaveUsage;
  /** 코어 종료 직후 근무일에 붙이는 부분휴가(늦은 출근). */
  trailingPartialUsage?: LeaveUsage;
  idPrefix?: string;
}

/** 부분휴가가 없을 때 휴식이 시작되는 시각 = 직전 근무일의 퇴근 시각. */
function naturalRestStart(
  index: CalendarIndex,
  schedule: WorkSchedule,
  coreStartIndex: number,
  coreStartDate: LocalDate,
): LocalDateTime {
  const previous = index.dayAt(coreStartIndex - 1);
  if (previous && previous.scheduledWorkMinutes > 0) {
    return atTime(previous.date, workEndTime(schedule, previous.scheduledWorkMinutes));
  }
  return startOfDay(coreStartDate);
}

/** 부분휴가가 없을 때 휴식이 끝나는 시각 = 직후 근무일의 출근 시각. */
function naturalRestEnd(
  index: CalendarIndex,
  schedule: WorkSchedule,
  coreEndIndex: number,
  coreEndDate: LocalDate,
): LocalDateTime {
  const next = index.dayAt(coreEndIndex + 1);
  if (next && next.scheduledWorkMinutes > 0) {
    return atTime(next.date, schedule.startTime);
  }
  return endOfDay(coreEndDate);
}

function collectReasonCodes(
  coreDays: DayInfo[],
  efficiency: number,
  restDays: number,
  leaveEquivalentDays: number,
  hasPartial: boolean,
): VacationReasonCode[] {
  const codes = new Set<VacationReasonCode>();

  for (const day of coreDays) {
    if (day.isWeekend) codes.add("CONNECTS_WEEKEND");
    if (day.isPublicHoliday && !day.isSubstituteHoliday) codes.add("CONNECTS_PUBLIC_HOLIDAY");
    if (day.isSubstituteHoliday) codes.add("CONNECTS_SUBSTITUTE_HOLIDAY");
    if (day.isCompanyHoliday) codes.add("CONNECTS_COMPANY_HOLIDAY");
  }

  if (efficiency >= HIGH_EFFICIENCY_THRESHOLD) codes.add("HIGH_EFFICIENCY");
  if (restDays >= LONG_BREAK_THRESHOLD_DAYS) codes.add("LONG_CONSECUTIVE_BREAK");
  if (leaveEquivalentDays > 0 && leaveEquivalentDays <= MINIMAL_LEAVE_THRESHOLD_DAYS) {
    codes.add("USES_MINIMAL_ANNUAL_LEAVE");
  }
  if (hasPartial) {
    codes.add("USES_PARTIAL_LEAVE");
    if (codes.has("CONNECTS_WEEKEND")) codes.add("EXTENDS_WEEKEND");
  }
  if (restDays >= 3) codes.add("GOOD_FOR_TRAVEL");

  return [...codes].sort();
}

function classifyTravelSuitability(restDays: number): TravelSuitability {
  if (restDays >= 8) return TravelSuitability.LongTravel;
  if (restDays >= 5) return TravelSuitability.RegionalTravel;
  if (restDays >= 3) return TravelSuitability.ShortTrip;
  return TravelSuitability.None;
}

function minutesByCategory(usages: LeaveUsage[], category: LeaveCategory): number {
  return usages
    .filter((usage) => usage.category === category)
    .reduce((sum, usage) => sum + usage.minutes, 0);
}

/**
 * 코어 구간과 휴가 사용 내역으로부터 완결된 VacationCandidate를 만든다.
 * 모든 후보 생성기는 반드시 이 함수를 거치므로, 지표 계산식이 한 곳에만 존재한다.
 */
export function buildCandidate(params: BuildCandidateParams): VacationCandidate {
  const { index, schedule, coreStartIndex, coreEndIndex } = params;
  const coreDays = index.days.slice(coreStartIndex, coreEndIndex + 1);
  const coreStartDate = coreDays[0].date;
  const coreEndDate = coreDays[coreDays.length - 1].date;

  const leaveUsages = [
    ...(params.leadingPartialUsage ? [params.leadingPartialUsage] : []),
    ...params.fullDayUsages,
    ...(params.trailingPartialUsage ? [params.trailingPartialUsage] : []),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const baseRestStart = naturalRestStart(index, schedule, coreStartIndex, coreStartDate);
  const baseRestEnd = naturalRestEnd(index, schedule, coreEndIndex, coreEndDate);

  const restStartDateTime = params.leadingPartialUsage?.startTime
    ? atTime(params.leadingPartialUsage.date, params.leadingPartialUsage.startTime)
    : baseRestStart;
  const restEndDateTime = params.trailingPartialUsage?.endTime
    ? atTime(params.trailingPartialUsage.date, params.trailingPartialUsage.endTime)
    : baseRestEnd;

  const totalCalendarDays = inclusiveDayCount(coreStartDate, coreEndDate);
  const totalRestMinutes = differenceInMinutes(restStartDateTime, restEndDateTime);
  const totalLeaveMinutesUsed = leaveUsages.reduce((sum, usage) => sum + usage.minutes, 0);
  const annualLeaveEquivalentDays = totalLeaveMinutesUsed / index.standardDailyWorkMinutes;

  // 자연 휴일만으로 이루어진 구간은 효율을 정의할 수 없다(0으로 나누지 않는다).
  const efficiencyScore =
    annualLeaveEquivalentDays > 0
      ? roundTo(totalCalendarDays / annualLeaveEquivalentDays, 2)
      : 0;

  const hasPartial = Boolean(params.leadingPartialUsage || params.trailingPartialUsage);
  const partialMetrics: PartialRestMetrics | undefined = hasPartial
    ? buildPartialMetrics(baseRestStart, baseRestEnd, restStartDateTime, restEndDateTime, totalLeaveMinutesUsed)
    : undefined;

  const weekendDates: LocalDate[] = [];
  const publicHolidayDates: LocalDate[] = [];
  const substituteHolidayDates: LocalDate[] = [];
  const companyHolidayDates: LocalDate[] = [];
  for (const day of coreDays) {
    if (day.isWeekend) weekendDates.push(day.date);
    if (day.isPublicHoliday && !day.isSubstituteHoliday) publicHolidayDates.push(day.date);
    if (day.isSubstituteHoliday) substituteHolidayDates.push(day.date);
    if (day.isCompanyHoliday) companyHolidayDates.push(day.date);
  }

  const idPrefix = params.idPrefix ?? "cand";
  const leaveSignature = leaveUsages
    .map((usage) => `${usage.date}:${usage.slot}:${usage.minutes}`)
    .join("|");

  return {
    id: `${idPrefix}_${coreStartDate}_${coreEndDate}_${leaveSignature}`,
    startDate: coreStartDate,
    endDate: coreEndDate,
    restStartDateTime,
    restEndDateTime,
    totalCalendarDays,
    totalRestMinutes,
    consecutiveFullRestDays: totalCalendarDays,
    annualLeaveMinutesUsed: minutesByCategory(leaveUsages, LeaveCategory.Annual),
    hourlyLeaveMinutesUsed: minutesByCategory(leaveUsages, LeaveCategory.Hourly),
    specialLeaveMinutesUsed:
      minutesByCategory(leaveUsages, LeaveCategory.Special) +
      minutesByCategory(leaveUsages, LeaveCategory.Sabbatical),
    totalLeaveMinutesUsed,
    annualLeaveEquivalentDays: roundTo(annualLeaveEquivalentDays, 4),
    leaveUsages,
    leaveDates: leaveUsages.map((usage) => usage.date),
    weekendDates,
    publicHolidayDates,
    substituteHolidayDates,
    companyHolidayDates,
    efficiencyScore,
    partialMetrics,
    reasonCodes: collectReasonCodes(
      coreDays,
      efficiencyScore,
      totalCalendarDays,
      annualLeaveEquivalentDays,
      hasPartial,
    ),
    travelSuitability: classifyTravelSuitability(totalCalendarDays),
    metadata: {},
  };
}

function buildPartialMetrics(
  baseStart: LocalDateTime,
  baseEnd: LocalDateTime,
  actualStart: LocalDateTime,
  actualEnd: LocalDateTime,
  leaveMinutes: number,
): PartialRestMetrics {
  const continuousRestMinutes = differenceInMinutes(actualStart, actualEnd);
  const baselineMinutes = differenceInMinutes(baseStart, baseEnd);
  const extensionMinutes = continuousRestMinutes - baselineMinutes;
  return {
    continuousRestMinutes,
    extensionMinutesComparedToNormal: extensionMinutes,
    leaveMinutesSpent: leaveMinutes,
    extensionEfficiency: leaveMinutes > 0 ? roundTo(extensionMinutes / leaveMinutes, 2) : 0,
  };
}

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
