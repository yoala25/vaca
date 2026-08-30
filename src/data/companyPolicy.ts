import { asLocalDate, localDate, toCivil, type LocalDate } from "../domain/vacation";

/**
 * 회사 휴가제도 설정.
 * 엔진이 그대로 소비할 수 있도록 표시용 문자열이 아니라 계산 가능한 값으로 저장한다.
 */
export interface CompanyHolidayEntry {
  id: string;
  name: string;
  startDate: LocalDate;
  endDate: LocalDate;
  recurring: boolean;
}

/** 리프레시휴가·안식휴가처럼 연차와 별도로 부여받는 휴가. */
export interface ExtraLeaveEntry {
  id: string;
  name: string;
  days: number;
}

/** 연차 소멸(정산) 기준. 회사마다 다르다. */
export type LeaveExpiryPreset = "year-end" | "next-march" | "next-june" | "custom";

export const LEAVE_EXPIRY_PRESETS: { value: LeaveExpiryPreset; label: string }[] = [
  { value: "year-end", label: "올해 12월 31일" },
  { value: "next-march", label: "내년 3월 31일" },
  { value: "next-june", label: "내년 6월 30일" },
  { value: "custom", label: "직접 입력" },
];

export interface CompanyPolicy {
  /** 회사가 부여한 기본 연차(일). */
  baseLeaveDays: number;
  /** 리프레시휴가 등 추가로 부여받은 휴가. 전체 휴가일수에 더해진다. */
  extraLeaves: ExtraLeaveEntry[];
  /**
   * 사용자가 직접 입력한 "남은 연차"(일). 추천 계산의 기준값이다.
   * 전체 휴가일수를 바꿔도 이 값은 사용자가 다시 입력하기 전까지 유지된다.
   */
  remainingLeaveDays: number;
  /** 반차 사용 가능 여부. */
  halfDayEnabled: boolean;
  /** 시간차 단위(분). null이면 시간차 미운영. */
  hourlyUnitMinutes: number | null;
  /** 하루 근무 시간(분). */
  dailyWorkMinutes: number;
  companyHolidays: CompanyHolidayEntry[];
  /** 연차를 언제까지 쓸 수 있는지. */
  leaveExpiryPreset: LeaveExpiryPreset;
  /** leaveExpiryPreset === "custom" 일 때의 소멸일(YYYY-MM-DD). */
  leaveExpiryCustomDate: string | null;
}

export const HOURLY_UNIT_OPTIONS = [
  { value: null, label: "사용 안 함" },
  { value: 60, label: "1시간 단위" },
  { value: 120, label: "2시간 단위" },
] as const;

export const DEFAULT_COMPANY_POLICY: CompanyPolicy = {
  baseLeaveDays: 15,
  extraLeaves: [],
  remainingLeaveDays: 7.5,
  halfDayEnabled: true,
  hourlyUnitMinutes: null,
  dailyWorkMinutes: 480,
  companyHolidays: [],
  // 대부분의 회사는 회계연도 말(12/31)에 연차가 소멸한다.
  leaveExpiryPreset: "year-end",
  leaveExpiryCustomDate: null,
};

/** 기본 연차 + 추가 휴가를 합친 올해 전체 휴가일수. */
export function totalLeaveDays(policy: CompanyPolicy): number {
  const extras = policy.extraLeaves.reduce((sum, entry) => sum + Math.max(0, entry.days), 0);
  return Math.round((Math.max(0, policy.baseLeaveDays) + extras) * 2) / 2;
}

export function remainingLeaveDays(policy: CompanyPolicy): number {
  return Math.max(0, Math.round(policy.remainingLeaveDays * 2) / 2);
}

/**
 * 연차를 실제로 쓸 수 있는 마지막 날짜.
 * 이 날짜가 지나면 연차는 소멸하거나 수당으로 정산되므로, 추천은 이 안에서만 이루어진다.
 */
export function resolveLeaveExpiryDate(policy: CompanyPolicy, today: LocalDate): LocalDate {
  const { year } = toCivil(today);

  switch (policy.leaveExpiryPreset) {
    case "next-march":
      return localDate(year + 1, 3, 31);
    case "next-june":
      return localDate(year + 1, 6, 30);
    case "custom":
      if (policy.leaveExpiryCustomDate) {
        try {
          return asLocalDate(policy.leaveExpiryCustomDate);
        } catch {
          return localDate(year, 12, 31);
        }
      }
      return localDate(year, 12, 31);
    case "year-end":
    default:
      return localDate(year, 12, 31);
  }
}

export function describeLeaveExpiry(policy: CompanyPolicy, today: LocalDate): string {
  const expiry = resolveLeaveExpiryDate(policy, today);
  const { year, month, day } = toCivil(expiry);
  return `${year}년 ${month}월 ${day}일`;
}
