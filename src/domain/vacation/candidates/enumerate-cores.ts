import type { CalendarIndex } from "../calendar/calendar-index";
import {
  ANNUAL_LEAVE_TYPE_ID,
  LeaveCategory,
  LeaveSlot,
  findLeaveType,
  type LeaveType,
  type LeaveUsage,
} from "../models/leave-type";

/**
 * "코어" = 하루 종일 완전히 쉬는 연속 구간.
 * 종일 후보와 부분휴가 후보가 모두 이 코어 위에 세워지므로 한 번만 열거해 공유한다.
 */
export interface CandidateCore {
  startIndex: number;
  endIndex: number;
  /** 코어 내부 근무일을 채우는 종일 연차. 자연 휴일만으로 된 코어면 빈 배열. */
  fullDayUsages: LeaveUsage[];
  leaveMinutes: number;
}

export interface EnumerateCoresOptions {
  index: CalendarIndex;
  leaveCatalog: LeaveType[];
  maxLeaveMinutes: number;
  maxSpanDays: number;
  blockedDates?: Set<string>;
  /**
   * 휴가를 전혀 쓰지 않는 순수 자연휴일 구간(주말/연휴)도 포함할지.
   * 부분휴가 후보의 토대로 필요하지만, 그 자체로는 추천 대상이 아니다.
   */
  includeZeroLeaveRuns?: boolean;
}

/**
 * 정규형 코어를 빠짐없이, 중복 없이 열거한다.
 *
 * 정규형: 구간 [i, j]의 바로 앞(i-1)과 바로 뒤(j+1)가 모두 근무일.
 * 앞뒤가 휴일이면 연차를 더 쓰지 않고도 구간을 넓힐 수 있어 더 넓은 코어에 흡수된다.
 * 구간 밖은 근무일로 간주하므로 달력 양 끝도 정상적으로 코어가 된다.
 */
export function enumerateCandidateCores(options: EnumerateCoresOptions): CandidateCore[] {
  const { index, leaveCatalog, maxLeaveMinutes, maxSpanDays } = options;
  const annualLeave = findLeaveType(leaveCatalog, ANNUAL_LEAVE_TYPE_ID);
  if (!annualLeave) return [];

  const blocked = options.blockedDates ?? new Set<string>();
  const cores: CandidateCore[] = [];

  for (let i = 0; i < index.length; i++) {
    if (!index.isWorkdayAt(i - 1)) continue;

    for (let j = i; j < index.length && j - i < maxSpanDays; j++) {
      const leaveMinutes = index.workMinutesBetween(i, j);
      if (leaveMinutes > maxLeaveMinutes) break;
      if (!index.isWorkdayAt(j + 1)) continue;
      if (leaveMinutes === 0 && !options.includeZeroLeaveRuns) continue;

      // 소멸일이 지난 날짜에 연차를 배치하는 코어는 아예 만들지 않는다.
      // (제약 검증에서도 걸리지만, 여기서 끊어야 탐색량이 줄어든다.)
      if (annualLeave.validUntil && leaveMinutes > 0 && index.days[j].date > annualLeave.validUntil) {
        const lastLeaveDate = lastLeaveDateInRange(index, i, j);
        if (lastLeaveDate && lastLeaveDate > annualLeave.validUntil) continue;
      }

      const fullDayUsages = collectFullDayUsages(index, i, j, annualLeave, blocked);
      if (!fullDayUsages) continue; // 휴가 사용 불가일 포함

      cores.push({ startIndex: i, endIndex: j, fullDayUsages, leaveMinutes });
    }
  }

  return cores;
}

/** 구간 안에서 실제로 연차를 쓰는 마지막 날짜. 휴가가 없으면 undefined. */
function lastLeaveDateInRange(
  index: CalendarIndex,
  fromIndex: number,
  toIndex: number,
): string | undefined {
  for (let k = toIndex; k >= fromIndex; k--) {
    if (index.days[k].scheduledWorkMinutes > 0) return index.days[k].date;
  }
  return undefined;
}

function collectFullDayUsages(
  index: CalendarIndex,
  fromIndex: number,
  toIndex: number,
  annualLeave: LeaveType,
  blockedDates: Set<string>,
): LeaveUsage[] | null {
  const usages: LeaveUsage[] = [];
  for (let k = fromIndex; k <= toIndex; k++) {
    const day = index.days[k];
    if (day.scheduledWorkMinutes === 0) continue;
    if (day.isUserBlockedDate || blockedDates.has(day.date)) return null;
    usages.push({
      date: day.date,
      leaveTypeId: annualLeave.id,
      category: LeaveCategory.Annual,
      minutes: day.scheduledWorkMinutes,
      slot: LeaveSlot.Full,
    });
  }
  return usages;
}
