import type { LocalDate, LocalTime } from "./local-date";

export const LeaveCategory = {
  Annual: "ANNUAL",
  HalfDay: "HALF_DAY",
  Hourly: "HOURLY",
  Special: "SPECIAL",
  Sabbatical: "SABBATICAL",
  Compensatory: "COMPENSATORY",
  Custom: "CUSTOM",
} as const;
export type LeaveCategory = (typeof LeaveCategory)[keyof typeof LeaveCategory];

/** 특별휴가 일수를 달력일로 세는지, 근무일로 세는지 (§29). */
export const LeaveDurationBasis = {
  CalendarDay: "CALENDAR_DAY_BASED",
  WorkingDay: "WORKING_DAY_BASED",
} as const;
export type LeaveDurationBasis = (typeof LeaveDurationBasis)[keyof typeof LeaveDurationBasis];

export interface LeaveType {
  id: string;
  name: string;
  category: LeaveCategory;

  /** 1회 사용 단위(분). 시간차 60/120, 반차 240 등. 미지정이면 그 날 근무시간 전체. */
  unitMinutes?: number;

  totalMinutes?: number;
  remainingMinutes?: number;

  /** true면 이 휴가 사용분이 연차 잔여에서 차감된다. */
  deductsFromAnnualLeave: boolean;
  /** 차감 대상 휴가 ID(보통 연차). */
  sourceLeaveTypeId?: string;

  allowedStartTimes?: LocalTime[];
  minimumUseMinutes?: number;
  maximumUseMinutesPerDay?: number;

  mustUseContinuously?: boolean;
  canSplit?: boolean;
  includesWeekend?: boolean;
  canCombineWithAnnualLeave?: boolean;

  /** 특별휴가 총량 표기 기준. */
  durationBasis?: LeaveDurationBasis;
  /** durationBasis 기준 총 일수(안식휴가 20 working days 등). */
  durationDays?: number;

  validFrom?: LocalDate;
  validUntil?: LocalDate;
}

/** 하루 중 휴가를 어느 위치에 붙였는지. */
export const LeaveSlot = {
  Full: "FULL",
  Morning: "AM",
  Afternoon: "PM",
  /** 근무 시작을 늦춤(연휴 직후 늦게 출근). */
  DayStart: "START",
  /** 근무 종료를 앞당김(연휴 직전 일찍 퇴근). */
  DayEnd: "END",
} as const;
export type LeaveSlot = (typeof LeaveSlot)[keyof typeof LeaveSlot];

export interface LeaveUsage {
  date: LocalDate;
  leaveTypeId: string;
  category: LeaveCategory;
  minutes: number;
  slot: LeaveSlot;
  /** 부분휴가일 때 실제 휴식이 시작/종료되는 시각. */
  startTime?: LocalTime;
  endTime?: LocalTime;
}

export const ANNUAL_LEAVE_TYPE_ID = "annual";
export const HALF_DAY_LEAVE_TYPE_ID = "half-day";
export const HOURLY_LEAVE_TYPE_ID = "hourly";

/** MVP 기본 휴가 종류 카탈로그. 회사 설정으로 덮어쓸 수 있다. */
export function createDefaultLeaveCatalog(options: {
  annualRemainingMinutes: number;
  annualTotalMinutes?: number;
  halfDayEnabled?: boolean;
  hourlyUnitMinutes?: number | null;
  standardDailyWorkMinutes: number;
  /**
   * 연차 소멸일. 이 날짜 이후로는 휴가를 배치하지 않는다.
   * 반차·시간차는 연차에서 차감되므로 같은 기한을 물려받는다.
   */
  validUntil?: LocalDate;
  /**
   * 연차와 별도로 부여받은 휴가(리프레시휴가·안식휴가 등).
   * continuous 인 항목만 별도 휴가 종류로 만든다 — 통째로 붙여 써야 하므로
   * 연차와 탐색 방식이 다르기 때문이다. 나눠 쓸 수 있는 항목은 호출부에서
   * annualRemainingMinutes 에 더해 넘기면 된다.
   */
  extraLeaves?: Array<{
    id: string;
    name: string;
    days: number;
    continuous?: boolean;
    countsCalendarDays?: boolean;
  }>;
}): LeaveType[] {
  const { validUntil } = options;

  const catalog: LeaveType[] = [
    {
      id: ANNUAL_LEAVE_TYPE_ID,
      name: "연차",
      category: LeaveCategory.Annual,
      unitMinutes: options.standardDailyWorkMinutes,
      totalMinutes: options.annualTotalMinutes ?? options.annualRemainingMinutes,
      remainingMinutes: options.annualRemainingMinutes,
      deductsFromAnnualLeave: true,
      canSplit: true,
      canCombineWithAnnualLeave: true,
      validUntil,
    },
  ];

  if (options.halfDayEnabled !== false) {
    catalog.push({
      id: HALF_DAY_LEAVE_TYPE_ID,
      name: "반차",
      category: LeaveCategory.HalfDay,
      unitMinutes: Math.round(options.standardDailyWorkMinutes / 2),
      deductsFromAnnualLeave: true,
      sourceLeaveTypeId: ANNUAL_LEAVE_TYPE_ID,
      canCombineWithAnnualLeave: true,
      validUntil,
    });
  }

  if (options.hourlyUnitMinutes) {
    catalog.push({
      id: HOURLY_LEAVE_TYPE_ID,
      name: "시간차",
      category: LeaveCategory.Hourly,
      unitMinutes: options.hourlyUnitMinutes,
      minimumUseMinutes: options.hourlyUnitMinutes,
      maximumUseMinutesPerDay: options.hourlyUnitMinutes * 2,
      deductsFromAnnualLeave: true,
      sourceLeaveTypeId: ANNUAL_LEAVE_TYPE_ID,
      canCombineWithAnnualLeave: true,
      validUntil,
    });
  }

  /*
   * 연속으로 써야 하는 추가 휴가를 특별휴가 종류로 만든다.
   * 연차에서 차감되지 않고(deductsFromAnnualLeave: false),
   * 연차와 섞어 쓰지 않는다(canCombineWithAnnualLeave: false) —
   * 리프레시휴가는 보통 "통째로 연속 사용"이 조건이기 때문이다.
   */
  for (const extra of options.extraLeaves ?? []) {
    if (!extra.continuous || extra.days <= 0) continue;
    catalog.push({
      id: extra.id,
      name: extra.name,
      category: LeaveCategory.Special,
      deductsFromAnnualLeave: false,
      durationBasis: extra.countsCalendarDays
        ? LeaveDurationBasis.CalendarDay
        : LeaveDurationBasis.WorkingDay,
      durationDays: extra.days,
      mustUseContinuously: true,
      canCombineWithAnnualLeave: false,
      validUntil,
    });
  }

  return catalog;
}

export function findLeaveType(catalog: LeaveType[], id: string): LeaveType | undefined {
  return catalog.find((type) => type.id === id);
}

/** 연차 잔여에서 실제로 차감되는 총 분. */
export function annualDeductedMinutes(usages: LeaveUsage[], catalog: LeaveType[]): number {
  return usages.reduce((sum, usage) => {
    const type = findLeaveType(catalog, usage.leaveTypeId);
    return type?.deductsFromAnnualLeave ? sum + usage.minutes : sum;
  }, 0);
}
