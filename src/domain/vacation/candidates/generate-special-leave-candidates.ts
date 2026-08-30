import type { CalendarIndex } from "../calendar/calendar-index";
import {
  LeaveCategory,
  LeaveDurationBasis,
  LeaveSlot,
  type LeaveType,
  type LeaveUsage,
} from "../models/leave-type";
import type { VacationCandidate } from "../models/vacation-candidate";
import type { WorkSchedule } from "../models/work-schedule";
import { buildCandidate } from "./build-candidate";

export interface SpecialLeaveGeneratorOptions {
  index: CalendarIndex;
  schedule: WorkSchedule;
  leaveCatalog: LeaveType[];
  blockedDates?: Set<string>;
}

/**
 * 안식휴가·리프레시휴가처럼 "일수"로 주어지는 장기 특별휴가 후보를 생성한다.
 *
 * 일반 연차 후보와 로직을 분리한 이유: 예산(분)이 아니라 일수로 소진되고,
 * 근무일 기준/달력일 기준이라는 별도 정책이 붙으며, 시작일만 정하면 길이가 결정되기
 * 때문에 탐색 구조 자체가 다르다.
 */
export function generateSpecialLeaveCandidates(
  options: SpecialLeaveGeneratorOptions,
): VacationCandidate[] {
  const specialTypes = options.leaveCatalog.filter(
    (type) =>
      (type.category === LeaveCategory.Special || type.category === LeaveCategory.Sabbatical) &&
      (type.durationDays ?? 0) > 0,
  );
  if (specialTypes.length === 0) return [];

  const blocked = options.blockedDates ?? new Set<string>();
  const candidates: VacationCandidate[] = [];

  for (const leaveType of specialTypes) {
    for (let start = 0; start < options.index.length; start++) {
      const startDay = options.index.days[start];
      // 특별휴가는 근무일에 시작해야 의미가 있다(휴일에 시작하면 앞으로 흡수된다).
      if (startDay.scheduledWorkMinutes === 0) continue;

      const consumed = consumeSpecialLeave(options.index, start, leaveType, blocked);
      if (!consumed) continue;

      const expanded = expandOverNaturalRest(options.index, start, consumed.endIndex);

      candidates.push(
        buildCandidate({
          index: options.index,
          schedule: options.schedule,
          leaveCatalog: options.leaveCatalog,
          coreStartIndex: expanded.startIndex,
          coreEndIndex: expanded.endIndex,
          fullDayUsages: consumed.usages,
          idPrefix: `special-${leaveType.id}`,
        }),
      );
    }
  }

  return candidates;
}

/** 정책 기준(근무일/달력일)에 따라 휴가를 소진하고, 소진이 끝나는 지점을 돌려준다. */
function consumeSpecialLeave(
  index: CalendarIndex,
  startIndex: number,
  leaveType: LeaveType,
  blockedDates: Set<string>,
): { endIndex: number; usages: LeaveUsage[] } | null {
  const durationDays = leaveType.durationDays ?? 0;
  const basis = leaveType.durationBasis ?? LeaveDurationBasis.WorkingDay;
  const usages: LeaveUsage[] = [];

  let workingDaysUsed = 0;
  let cursor = startIndex;
  let endIndex = startIndex;

  while (cursor < index.length) {
    const day = index.days[cursor];
    const isWorkday = day.scheduledWorkMinutes > 0;

    if (isWorkday) {
      if (day.isUserBlockedDate || blockedDates.has(day.date)) return null;
      usages.push({
        date: day.date,
        leaveTypeId: leaveType.id,
        category: leaveType.category,
        minutes: day.scheduledWorkMinutes,
        slot: LeaveSlot.Full,
      });
      workingDaysUsed++;
    }

    endIndex = cursor;

    const reachedLimit =
      basis === LeaveDurationBasis.WorkingDay
        ? workingDaysUsed >= durationDays
        : cursor - startIndex + 1 >= durationDays;
    if (reachedLimit) {
      return { endIndex, usages };
    }
    cursor++;
  }

  return null; // 달력 구간 안에서 휴가를 다 쓰지 못한다
}

/** 앞뒤로 붙어 있는 주말·공휴일을 휴가 소모 없이 흡수한다. */
function expandOverNaturalRest(
  index: CalendarIndex,
  startIndex: number,
  endIndex: number,
): { startIndex: number; endIndex: number } {
  let start = startIndex;
  let end = endIndex;
  while (start - 1 >= 0 && !index.isWorkdayAt(start - 1)) start--;
  while (end + 1 < index.length && !index.isWorkdayAt(end + 1)) end++;
  return { startIndex: start, endIndex: end };
}
