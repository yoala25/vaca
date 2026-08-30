import { LeaveCategory, LeaveSlot, findLeaveType } from "../models/leave-type";
import { VALID, invalid, type VacationConstraint } from "./constraint";

/** 잔여 연차보다 많이 쓰는 후보는 성립하지 않는다. */
export function annualLeaveBalanceConstraint(): VacationConstraint {
  return {
    id: "annual-leave-balance",
    validate: (candidate, context) => {
      const deducted = candidate.leaveUsages.reduce((sum, usage) => {
        const type = findLeaveType(context.leaveCatalog, usage.leaveTypeId);
        return type?.deductsFromAnnualLeave ? sum + usage.minutes : sum;
      }, 0);
      return deducted <= context.annualLeaveRemainingMinutes
        ? VALID
        : invalid(`연차 잔여(${context.annualLeaveRemainingMinutes}분)를 초과합니다`);
    },
  };
}

/** 자연 휴일에는 휴가를 소비하지 않는다(불변식). */
export function noLeaveOnRestDayConstraint(): VacationConstraint {
  return {
    id: "no-leave-on-rest-day",
    validate: (candidate, context) => {
      for (const usage of candidate.leaveUsages) {
        const day = context.index.dayAt(context.index.indexOf(usage.date));
        if (!day) return invalid(`${usage.date}는 달력 범위 밖입니다`);
        if (day.scheduledWorkMinutes === 0) {
          return invalid(`${usage.date}는 원래 쉬는 날이라 휴가가 필요 없습니다`);
        }
        if (usage.minutes > day.scheduledWorkMinutes) {
          return invalid(`${usage.date}의 근무시간보다 많은 휴가를 사용할 수 없습니다`);
        }
      }
      return VALID;
    },
  };
}

/** 사용자가 휴가 불가로 지정한 날 (§40). */
export function blockedDatesConstraint(): VacationConstraint {
  return {
    id: "blocked-dates",
    validate: (candidate, context) => {
      for (const usage of candidate.leaveUsages) {
        const day = context.index.dayAt(context.index.indexOf(usage.date));
        if (day?.isUserBlockedDate) {
          return invalid(`${usage.date}는 휴가를 쓸 수 없는 날로 지정되어 있습니다`);
        }
      }
      return VALID;
    },
  };
}

/** 연속으로 붙일 수 있는 연차 일수 상한. */
export function maxConsecutiveAnnualLeaveConstraint(maxDays: number): VacationConstraint {
  return {
    id: "max-consecutive-annual-leave",
    validate: (candidate) => {
      const fullDayCount = candidate.leaveUsages.filter(
        (usage) => usage.slot === LeaveSlot.Full && usage.category === LeaveCategory.Annual,
      ).length;
      return fullDayCount <= maxDays
        ? VALID
        : invalid(`연속 연차는 최대 ${maxDays}일까지 사용할 수 있습니다`);
    },
  };
}

/** 하루에 쓸 수 있는 시간차 상한. */
export function maxHourlyMinutesPerDayConstraint(maxMinutes: number): VacationConstraint {
  return {
    id: "max-hourly-minutes-per-day",
    validate: (candidate) => {
      const perDay = new Map<string, number>();
      for (const usage of candidate.leaveUsages) {
        if (usage.category !== LeaveCategory.Hourly) continue;
        perDay.set(usage.date, (perDay.get(usage.date) ?? 0) + usage.minutes);
      }
      for (const [date, minutes] of perDay) {
        if (minutes > maxMinutes) {
          return invalid(`${date}에 시간차를 ${maxMinutes}분 넘게 사용할 수 없습니다`);
        }
      }
      return VALID;
    },
  };
}

/** 같은 날 반차와 시간차를 동시에 사용하지 않는다. */
export function noHalfDayWithHourlyConstraint(): VacationConstraint {
  return {
    id: "no-half-day-with-hourly",
    validate: (candidate) => {
      const categoriesByDate = new Map<string, Set<string>>();
      for (const usage of candidate.leaveUsages) {
        const set = categoriesByDate.get(usage.date) ?? new Set<string>();
        set.add(usage.category);
        categoriesByDate.set(usage.date, set);
      }
      for (const [date, categories] of categoriesByDate) {
        if (categories.has(LeaveCategory.HalfDay) && categories.has(LeaveCategory.Hourly)) {
          return invalid(`${date}에 반차와 시간차를 함께 사용할 수 없습니다`);
        }
      }
      return VALID;
    },
  };
}

function isSpecialCategory(category: string): boolean {
  return category === LeaveCategory.Special || category === LeaveCategory.Sabbatical;
}

/** 특별휴가(안식/리프레시)를 연차와 붙여 쓰지 못하게 한다. */
export function specialLeaveNotCombinedConstraint(): VacationConstraint {
  return {
    id: "special-leave-not-combined",
    validate: (candidate, context) => {
      const specialUsages = candidate.leaveUsages.filter((usage) =>
        isSpecialCategory(usage.category),
      );
      const hasOtherLeave = candidate.leaveUsages.some(
        (usage) => !isSpecialCategory(usage.category),
      );
      if (specialUsages.length === 0 || !hasOtherLeave) return VALID;

      for (const usage of specialUsages) {
        const type = findLeaveType(context.leaveCatalog, usage.leaveTypeId);
        if (type?.canCombineWithAnnualLeave === false) {
          return invalid(`${type.name}은 다른 휴가와 연결해서 사용할 수 없습니다`);
        }
      }
      return VALID;
    },
  };
}

/** 휴가 유효기간을 벗어난 사용 방지 (§39). */
export function leaveValidityPeriodConstraint(): VacationConstraint {
  return {
    id: "leave-validity-period",
    validate: (candidate, context) => {
      for (const usage of candidate.leaveUsages) {
        const type = findLeaveType(context.leaveCatalog, usage.leaveTypeId);
        if (!type) continue;
        if (type.validFrom && usage.date < type.validFrom) {
          return invalid(`${type.name}은 ${type.validFrom}부터 사용할 수 있습니다`);
        }
        if (type.validUntil && usage.date > type.validUntil) {
          return invalid(`${type.name}은 ${type.validUntil}까지만 사용할 수 있습니다`);
        }
      }
      return VALID;
    },
  };
}

/** MVP 기본 제약 묶음. */
export function createDefaultConstraints(): VacationConstraint[] {
  return [
    annualLeaveBalanceConstraint(),
    noLeaveOnRestDayConstraint(),
    blockedDatesConstraint(),
    noHalfDayWithHourlyConstraint(),
    leaveValidityPeriodConstraint(),
  ];
}
