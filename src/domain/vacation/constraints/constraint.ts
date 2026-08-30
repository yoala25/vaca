import type { CalendarIndex } from "../calendar/calendar-index";
import type { LeaveType } from "../models/leave-type";
import type { VacationCandidate } from "../models/vacation-candidate";
import type { WorkSchedule } from "../models/work-schedule";

export interface VacationContext {
  index: CalendarIndex;
  schedule: WorkSchedule;
  leaveCatalog: LeaveType[];
  /** 연차 잔여(분). */
  annualLeaveRemainingMinutes: number;
}

export interface ConstraintResult {
  valid: boolean;
  reason?: string;
}

/**
 * 회사 휴가 규칙 한 가지.
 * 규칙을 if문으로 흩뿌리지 않고 이 인터페이스 구현체로만 추가한다 (§16).
 */
export interface VacationConstraint {
  id: string;
  validate(candidate: VacationCandidate, context: VacationContext): ConstraintResult;
}

export const VALID: ConstraintResult = { valid: true };

export function invalid(reason: string): ConstraintResult {
  return { valid: false, reason };
}
