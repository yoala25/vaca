import { LeaveCategory, LeaveSlot, type LeaveType } from "../models/leave-type";
import type { LocalDate } from "../models/local-date";
import type { VacationCandidate } from "../models/vacation-candidate";
import type {
  CalendarOverlay,
  VacationOverlayRange,
  VacationPortfolio,
} from "../models/vacation-plan";
import {
  formatDateRange,
  generateCandidateLabel,
  generateExplanation,
  generateHeadline,
} from "../explanations/generate-explanation";

export interface OverlayOptions {
  portfolio: VacationPortfolio;
  holidayNamesByDate: Map<LocalDate, string>;
  standardDailyWorkMinutes: number;
  /** 휴가 이름을 표시하기 위해 필요하다(리프레시휴가 등). */
  leaveCatalog: LeaveType[];
}

type PartialPeriod = "AM" | "PM" | "START" | "END";

function toPartialPeriod(slot: LeaveSlot): PartialPeriod | undefined {
  switch (slot) {
    case LeaveSlot.Morning:
      return "AM";
    case LeaveSlot.Afternoon:
      return "PM";
    case LeaveSlot.DayStart:
      return "START";
    case LeaveSlot.DayEnd:
      return "END";
    default:
      return undefined;
  }
}

/**
 * 엔진 결과를 UI가 그대로 칠할 수 있는 형태로 변환한다 (§33).
 * UI는 날짜 계산을 다시 하지 않고 이 데이터만 읽는다.
 */
export function generateCalendarOverlay(options: OverlayOptions): CalendarOverlay {
  const ranges = options.portfolio.selectedCandidates.map((candidate) =>
    toOverlayRange(candidate, options),
  );
  return { strategy: options.portfolio.strategy, ranges };
}

/** 이 구간에서 쓴 특별휴가의 이름. 연차만 썼으면 undefined. */
function specialLeaveNameOf(
  candidate: VacationCandidate,
  leaveCatalog: LeaveType[],
): string | undefined {
  if (candidate.specialLeaveMinutesUsed <= 0) return undefined;
  for (const usage of candidate.leaveUsages) {
    if (usage.category === LeaveCategory.Special || usage.category === LeaveCategory.Sabbatical) {
      return leaveCatalog.find((type) => type.id === usage.leaveTypeId)?.name;
    }
  }
  return undefined;
}

function toOverlayRange(
  candidate: VacationCandidate,
  options: OverlayOptions,
): VacationOverlayRange {
  const fullDayLeaveDates: LocalDate[] = [];
  const partialLeaveDates: VacationOverlayRange["partialLeaveDates"] = [];

  for (const usage of candidate.leaveUsages) {
    const period = toPartialPeriod(usage.slot);
    if (period) {
      partialLeaveDates.push({ date: usage.date, minutes: usage.minutes, period });
    } else {
      fullDayLeaveDates.push(usage.date);
    }
  }

  const { label, emoji } = generateCandidateLabel(candidate, options.holidayNamesByDate);

  return {
    candidateId: candidate.id,
    startDate: candidate.startDate,
    endDate: candidate.endDate,
    leaveDates: fullDayLeaveDates,
    partialLeaveDates,
    weekendDates: candidate.weekendDates,
    publicHolidayDates: candidate.publicHolidayDates,
    substituteHolidayDates: candidate.substituteHolidayDates,
    companyHolidayDates: candidate.companyHolidayDates,
    totalRestDays: candidate.consecutiveFullRestDays,
    totalRestMinutes: candidate.totalRestMinutes,
    leaveUsedMinutes: candidate.totalLeaveMinutesUsed,
    leaveUsedDays: Math.round(candidate.annualLeaveEquivalentDays * 10) / 10,
    specialLeaveUsedDays:
      Math.round((candidate.specialLeaveMinutesUsed / options.standardDailyWorkMinutes) * 10) / 10,
    specialLeaveName: specialLeaveNameOf(candidate, options.leaveCatalog),
    // 표시용 값은 소수점 한 자리로 통일한다(2.4x / 4.2x 처럼 읽히도록).
    efficiency: Math.round(candidate.efficiencyScore * 10) / 10,
    label,
    emoji,
    headline: generateHeadline(candidate),
    description: `${formatDateRange(candidate.startDate, candidate.endDate)} · ${generateExplanation(candidate)}`,
  };
}
