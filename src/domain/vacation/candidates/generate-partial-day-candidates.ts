import type { CalendarIndex } from "../calendar/calendar-index";
import type { DayInfo } from "../models/day-info";
import {
  HALF_DAY_LEAVE_TYPE_ID,
  HOURLY_LEAVE_TYPE_ID,
  LeaveCategory,
  LeaveSlot,
  findLeaveType,
  type LeaveType,
  type LeaveUsage,
} from "../models/leave-type";
import type { LocalTime } from "../models/local-date";
import type { VacationCandidate } from "../models/vacation-candidate";
import { timeAfterWorkedMinutes, workEndTime, type WorkSchedule } from "../models/work-schedule";
import { buildCandidate } from "./build-candidate";
import type { CandidateCore } from "./enumerate-cores";

export interface PartialGeneratorOptions {
  index: CalendarIndex;
  schedule: WorkSchedule;
  leaveCatalog: LeaveType[];
  cores: CandidateCore[];
  maxLeaveMinutes: number;
  blockedDates?: Set<string>;
  /**
   * 부분휴가를 붙일 코어의 연차 사용량 상한.
   * 2주짜리 휴가에 2시간차를 붙이는 조합은 가치가 없으면서 후보 수만 폭증시킨다.
   */
  maxCoreLeaveMinutes?: number;
}

/** 코어 경계에 붙일 수 있는 부분휴가 한 가지. */
interface PartialOption {
  leaveType: LeaveType;
  minutes: number;
  slot: LeaveSlot;
}

/**
 * 반차·시간차 후보를 생성한다.
 *
 * 하루 한가운데 임의 시각에 시간차를 꽂으면 후보 수만 폭발하고 사용자 가치는 없다.
 * 부분휴가가 실제로 가치를 만드는 위치는 "연속 휴식의 경계"뿐이므로,
 * 코어 직전 근무일(조퇴)과 코어 직후 근무일(늦은 출근)에만 붙인다.
 */
export function generatePartialDayCandidates(
  options: PartialGeneratorOptions,
): VacationCandidate[] {
  const { index, schedule, leaveCatalog, cores, maxLeaveMinutes } = options;
  const blocked = options.blockedDates ?? new Set<string>();

  const leadingOptions = buildLeadingOptions(leaveCatalog);
  const trailingOptions = buildTrailingOptions(leaveCatalog);
  if (leadingOptions.length === 0 && trailingOptions.length === 0) return [];

  const maxCoreLeaveMinutes = options.maxCoreLeaveMinutes ?? Number.POSITIVE_INFINITY;
  const candidates: VacationCandidate[] = [];

  for (const core of cores) {
    if (core.leaveMinutes > maxCoreLeaveMinutes) continue;
    const leadingDay = index.dayAt(core.startIndex - 1);
    const trailingDay = index.dayAt(core.endIndex + 1);

    const leadingChoices = usableDay(leadingDay, blocked) ? [undefined, ...leadingOptions] : [undefined];
    const trailingChoices = usableDay(trailingDay, blocked) ? [undefined, ...trailingOptions] : [undefined];

    for (const leading of leadingChoices) {
      for (const trailing of trailingChoices) {
        if (!leading && !trailing) continue; // 부분휴가가 없으면 종일 후보와 동일
        if (!isCombinationAllowed(leading, trailing)) continue;

        const leadingUsage = leading && leadingDay ? makeLeadingUsage(schedule, leadingDay, leading) : undefined;
        const trailingUsage =
          trailing && trailingDay ? makeTrailingUsage(schedule, trailingDay, trailing) : undefined;

        const totalMinutes =
          core.leaveMinutes + (leadingUsage?.minutes ?? 0) + (trailingUsage?.minutes ?? 0);
        if (totalMinutes > maxLeaveMinutes) continue;

        candidates.push(
          buildCandidate({
            index,
            schedule,
            leaveCatalog,
            coreStartIndex: core.startIndex,
            coreEndIndex: core.endIndex,
            fullDayUsages: core.fullDayUsages,
            leadingPartialUsage: leadingUsage,
            trailingPartialUsage: trailingUsage,
            idPrefix: "partial",
          }),
        );
      }
    }
  }

  return candidates;
}

function usableDay(day: DayInfo | undefined, blocked: Set<string>): day is DayInfo {
  if (!day) return false;
  if (day.scheduledWorkMinutes <= 0) return false;
  return !day.isUserBlockedDate && !blocked.has(day.date);
}

/** 반차 + 시간차를 같은 후보에서 동시에 쓰지 않는다(회사 규정상 흔한 제약). */
function isCombinationAllowed(leading?: PartialOption, trailing?: PartialOption): boolean {
  if (!leading || !trailing) return true;
  const categories = new Set([leading.leaveType.category, trailing.leaveType.category]);
  return !(categories.has(LeaveCategory.HalfDay) && categories.has(LeaveCategory.Hourly));
}

function buildLeadingOptions(catalog: LeaveType[]): PartialOption[] {
  return buildOptions(catalog, LeaveSlot.Afternoon, LeaveSlot.DayEnd);
}

function buildTrailingOptions(catalog: LeaveType[]): PartialOption[] {
  return buildOptions(catalog, LeaveSlot.Morning, LeaveSlot.DayStart);
}

function buildOptions(
  catalog: LeaveType[],
  halfDaySlot: LeaveSlot,
  hourlySlot: LeaveSlot,
): PartialOption[] {
  const options: PartialOption[] = [];

  const halfDay = findLeaveType(catalog, HALF_DAY_LEAVE_TYPE_ID);
  if (halfDay && hasRemaining(halfDay)) {
    options.push({ leaveType: halfDay, minutes: halfDay.unitMinutes ?? 240, slot: halfDaySlot });
  }

  const hourly = findLeaveType(catalog, HOURLY_LEAVE_TYPE_ID);
  if (hourly && hasRemaining(hourly)) {
    const unit = hourly.unitMinutes ?? 60;
    const maxPerDay = hourly.maximumUseMinutesPerDay ?? unit;
    for (let minutes = unit; minutes <= maxPerDay; minutes += unit) {
      options.push({ leaveType: hourly, minutes, slot: hourlySlot });
    }
  }

  return options;
}

function hasRemaining(leaveType: LeaveType): boolean {
  return leaveType.remainingMinutes === undefined || leaveType.remainingMinutes > 0;
}

/** 코어 직전 근무일에 붙는 부분휴가 = 일찍 퇴근해서 휴식을 앞당긴다. */
function makeLeadingUsage(
  schedule: WorkSchedule,
  day: DayInfo,
  option: PartialOption,
): LeaveUsage {
  const restStartTime: LocalTime =
    option.slot === LeaveSlot.Afternoon
      ? schedule.halfDayBoundaryTime
      : timeAfterWorkedMinutes(schedule, day.scheduledWorkMinutes - option.minutes);

  return {
    date: day.date,
    leaveTypeId: option.leaveType.id,
    category: option.leaveType.category,
    minutes: option.minutes,
    slot: option.slot,
    startTime: restStartTime,
    endTime: workEndTime(schedule, day.scheduledWorkMinutes),
  };
}

/** 코어 직후 근무일에 붙는 부분휴가 = 늦게 출근해서 휴식을 늘린다. */
function makeTrailingUsage(
  schedule: WorkSchedule,
  day: DayInfo,
  option: PartialOption,
): LeaveUsage {
  const restEndTime: LocalTime =
    option.slot === LeaveSlot.Morning
      ? schedule.halfDayBoundaryTime
      : timeAfterWorkedMinutes(schedule, option.minutes);

  return {
    date: day.date,
    leaveTypeId: option.leaveType.id,
    category: option.leaveType.category,
    minutes: option.minutes,
    slot: option.slot,
    startTime: schedule.startTime,
    endTime: restEndTime,
  };
}
