import type { CalendarIndex } from "../calendar/calendar-index";
import type { VacationConstraint, VacationContext } from "../constraints/constraint";
import { filterValidCandidates } from "../constraints/validate-candidate";
import type { LeaveType } from "../models/leave-type";
import type { VacationCandidate } from "../models/vacation-candidate";
import type { WorkSchedule } from "../models/work-schedule";
import { clusterSimilarCandidates, removeDominatedCandidates } from "./dedupe-candidates";
import { enumerateCandidateCores } from "./enumerate-cores";
import { generateFullDayCandidates } from "./generate-full-day-candidates";
import { generatePartialDayCandidates } from "./generate-partial-day-candidates";
import { generateSpecialLeaveCandidates } from "./generate-special-leave-candidates";

/** 후보 하나가 가질 수 있는 최대 길이. 탐색 폭발을 막는 안전장치 (§10). */
export const DEFAULT_MAX_SPAN_DAYS = 30;
/** 추천할 가치가 있는 최소 휴식일. 1일 써서 1일 쉬는 결과를 걸러낸다. */
export const DEFAULT_MIN_REST_DAYS = 2;
/** 추천할 가치가 있는 최소 효율. */
export const DEFAULT_MIN_EFFICIENCY = 2;
/**
 * 부분휴가(반차/시간차)를 붙일 코어의 연차 사용량 상한(일).
 * 긴 휴가에 몇 시간을 더 붙이는 조합은 사용자 가치가 없으면서 후보 수만 폭증시킨다.
 */
export const DEFAULT_MAX_PARTIAL_CORE_LEAVE_DAYS = 2;

export interface GenerateCandidatesOptions {
  index: CalendarIndex;
  schedule: WorkSchedule;
  leaveCatalog: LeaveType[];
  annualLeaveRemainingMinutes: number;
  constraints: VacationConstraint[];
  blockedDates?: Set<string>;
  includeSpecialLeave?: boolean;
  maxSpanDays?: number;
  minRestDays?: number;
  minEfficiency?: number;
  maxPartialCoreLeaveDays?: number;
}

/**
 * 전략과 무관한 "후보 풀"을 만든다.
 *
 * 이 풀은 전략이 바뀌어도 재사용된다 (§34, §51). 전략에 따라 달라지는 것은
 * 점수 계산과 포트폴리오 선택뿐이므로, 여기서는 어떤 전략에도 치우치지 않게
 * Pareto 대표들을 폭넓게 남긴다.
 */
export function generateCandidates(options: GenerateCandidatesOptions): VacationCandidate[] {
  const {
    index,
    schedule,
    leaveCatalog,
    annualLeaveRemainingMinutes,
    constraints,
  } = options;

  const maxSpanDays = options.maxSpanDays ?? DEFAULT_MAX_SPAN_DAYS;
  const minRestDays = options.minRestDays ?? DEFAULT_MIN_REST_DAYS;
  const minEfficiency = options.minEfficiency ?? DEFAULT_MIN_EFFICIENCY;

  const cores = enumerateCandidateCores({
    index,
    leaveCatalog,
    maxLeaveMinutes: annualLeaveRemainingMinutes,
    maxSpanDays,
    blockedDates: options.blockedDates,
    // 부분휴가는 순수 주말/연휴에 붙이는 것이 가장 가치가 크므로 0-비용 코어도 필요하다.
    includeZeroLeaveRuns: true,
  });

  const raw: VacationCandidate[] = [
    ...generateFullDayCandidates({ index, schedule, leaveCatalog, cores }),
    ...generatePartialDayCandidates({
      index,
      schedule,
      leaveCatalog,
      cores,
      maxLeaveMinutes: annualLeaveRemainingMinutes,
      blockedDates: options.blockedDates,
      maxCoreLeaveMinutes:
        (options.maxPartialCoreLeaveDays ?? DEFAULT_MAX_PARTIAL_CORE_LEAVE_DAYS) *
        index.standardDailyWorkMinutes,
    }),
  ];

  if (options.includeSpecialLeave) {
    raw.push(
      ...generateSpecialLeaveCandidates({
        index,
        schedule,
        leaveCatalog,
        blockedDates: options.blockedDates,
      }),
    );
  }

  const context: VacationContext = {
    index,
    schedule,
    leaveCatalog,
    annualLeaveRemainingMinutes,
  };

  const meaningful = raw.filter((candidate) =>
    isWorthRecommending(candidate, minRestDays, minEfficiency),
  );
  const valid = filterValidCandidates(meaningful, constraints, context);

  return clusterSimilarCandidates(removeDominatedCandidates(valid));
}

/**
 * "1시간 써서 1시간 쉬기" 같은 사소한 결과를 후보 단계에서 제거한다 (§19).
 * 부분휴가 후보는 코어 휴식일이 짧아도 경계 연장 가치가 있으므로 별도로 판정한다.
 */
function isWorthRecommending(
  candidate: VacationCandidate,
  minRestDays: number,
  minEfficiency: number,
): boolean {
  if (candidate.totalLeaveMinutesUsed <= 0) return false;
  if (candidate.consecutiveFullRestDays < minRestDays) return false;

  if (candidate.partialMetrics) {
    // 부분휴가는 "얼마나 더 길어졌나"로 평가한다.
    return candidate.partialMetrics.extensionMinutesComparedToNormal > 0;
  }

  // 안식·리프레시휴가는 연차 효율로 잴 대상이 아니다.
  // 20일을 써서 28일을 쉬면 효율은 1.4지만 그것이 이 휴가의 목적이다.
  if (candidate.specialLeaveMinutesUsed > 0) return true;

  return candidate.efficiencyScore >= minEfficiency;
}
