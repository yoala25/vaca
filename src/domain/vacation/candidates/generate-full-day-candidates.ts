import type { CalendarIndex } from "../calendar/calendar-index";
import type { LeaveType } from "../models/leave-type";
import type { VacationCandidate } from "../models/vacation-candidate";
import type { WorkSchedule } from "../models/work-schedule";
import { buildCandidate } from "./build-candidate";
import type { CandidateCore } from "./enumerate-cores";

export interface FullDayGeneratorOptions {
  index: CalendarIndex;
  schedule: WorkSchedule;
  leaveCatalog: LeaveType[];
  cores: CandidateCore[];
}

/**
 * 종일 연차만 사용하는 후보를 만든다.
 * 코어 열거(enumerateCandidateCores)가 이미 전수·무중복을 보장하므로,
 * 여기서는 휴가를 실제로 쓰는 코어만 후보로 승격한다.
 */
export function generateFullDayCandidates(
  options: FullDayGeneratorOptions,
): VacationCandidate[] {
  return options.cores
    .filter((core) => core.leaveMinutes > 0)
    .map((core) =>
      buildCandidate({
        index: options.index,
        schedule: options.schedule,
        leaveCatalog: options.leaveCatalog,
        coreStartIndex: core.startIndex,
        coreEndIndex: core.endIndex,
        fullDayUsages: core.fullDayUsages,
        idPrefix: "full",
      }),
    );
}
