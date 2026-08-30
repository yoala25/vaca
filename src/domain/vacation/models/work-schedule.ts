import {
  DayOfWeek,
  asLocalTime,
  minutesOfDay,
  timeFromMinutes,
  type LocalDate,
  type LocalTime,
} from "./local-date";

export interface BreakPeriod {
  start: LocalTime;
  end: LocalTime;
}

/** 특정 날짜만 근무시간이 다른 경우(단축근무, 특별근무일 등). */
export interface WorkScheduleOverride {
  date: LocalDate;
  workMinutes: number;
}

export interface WorkSchedule {
  workingDays: DayOfWeek[];
  startTime: LocalTime;
  endTime: LocalTime;
  breakPeriods: BreakPeriod[];
  /** startTime~endTime에서 breakPeriods를 제외한 순수 근무 분. */
  defaultDailyWorkMinutes: number;
  /**
   * 오전/오후 반차가 갈리는 벽시계 시각.
   *
   * 실제 근무 분을 정확히 반으로 나눈 지점(09-18시, 점심 1시간이면 14:00)과
   * 한국 기업의 통상 관행(점심 경계 = 13:00)이 다르다. 반차 차감 분수는 사규가 정하는
   * 값(LeaveType.unitMinutes)이고 경계 시각은 별개 정책이므로, 둘을 분리해서 둔다.
   * 기본값은 점심 휴게가 끝나는 시각이다.
   */
  halfDayBoundaryTime: LocalTime;
  overrides: WorkScheduleOverride[];
}

export interface WorkScheduleInput {
  workingDays?: DayOfWeek[];
  startTime?: string;
  endTime?: string;
  breakPeriods?: { start: string; end: string }[];
  halfDayBoundaryTime?: string;
  overrides?: WorkScheduleOverride[];
}

const DEFAULT_WORKING_DAYS: DayOfWeek[] = [
  DayOfWeek.Monday,
  DayOfWeek.Tuesday,
  DayOfWeek.Wednesday,
  DayOfWeek.Thursday,
  DayOfWeek.Friday,
];

export function createWorkSchedule(input: WorkScheduleInput = {}): WorkSchedule {
  const startTime = asLocalTime(input.startTime ?? "09:00");
  const endTime = asLocalTime(input.endTime ?? "18:00");
  const breakPeriods = (input.breakPeriods ?? [{ start: "12:00", end: "13:00" }]).map((period) => ({
    start: asLocalTime(period.start),
    end: asLocalTime(period.end),
  }));

  const span = minutesOfDay(endTime) - minutesOfDay(startTime);
  const breakMinutes = breakPeriods.reduce(
    (sum, period) => sum + Math.max(0, minutesOfDay(period.end) - minutesOfDay(period.start)),
    0,
  );

  const defaultDailyWorkMinutes = Math.max(0, span - breakMinutes);
  const schedule: WorkSchedule = {
    workingDays: [...(input.workingDays ?? DEFAULT_WORKING_DAYS)].sort((a, b) => a - b),
    startTime,
    endTime,
    breakPeriods,
    defaultDailyWorkMinutes,
    halfDayBoundaryTime: startTime, // 아래에서 확정한다
    overrides: input.overrides ?? [],
  };

  schedule.halfDayBoundaryTime = input.halfDayBoundaryTime
    ? asLocalTime(input.halfDayBoundaryTime)
    : defaultHalfDayBoundary(schedule);

  return schedule;
}

/** 점심 휴게가 있으면 그 종료 시각을, 없으면 근무 분을 정확히 반으로 가른 시각을 쓴다. */
function defaultHalfDayBoundary(schedule: WorkSchedule): LocalTime {
  const middayBreak = [...schedule.breakPeriods]
    .sort((a, b) => minutesOfDay(a.start) - minutesOfDay(b.start))
    .find((period) => minutesOfDay(period.end) > minutesOfDay(schedule.startTime));

  if (middayBreak) return middayBreak.end;
  return timeAfterWorkedMinutes(schedule, schedule.defaultDailyWorkMinutes / 2);
}

/**
 * 근무 일정표상 그 날의 근무 분.
 * 공휴일·회사휴무는 아직 반영하지 않은, 순수 "근무 로스터" 기준값이다.
 */
export function rosterWorkMinutes(schedule: WorkSchedule, date: LocalDate, dow: DayOfWeek): number {
  const override = schedule.overrides.find((entry) => entry.date === date);
  if (override) return Math.max(0, override.workMinutes);
  return schedule.workingDays.includes(dow) ? schedule.defaultDailyWorkMinutes : 0;
}

/**
 * 근무 시작 시각부터 `workedMinutes`만큼 실제로 일한 뒤의 벽시계 시각.
 * 휴게시간은 근무 분에 포함되지 않으므로 건너뛴다.
 *
 * 예) 09:00~18:00, 점심 12:00~13:00에서 workedMinutes=240 → 13:00 (오전반차 경계)
 */
export function timeAfterWorkedMinutes(schedule: WorkSchedule, workedMinutes: number): LocalTime {
  const sortedBreaks = [...schedule.breakPeriods].sort(
    (a, b) => minutesOfDay(a.start) - minutesOfDay(b.start),
  );

  let remaining = Math.max(0, workedMinutes);
  let clock = minutesOfDay(schedule.startTime);

  for (const period of sortedBreaks) {
    const breakStart = minutesOfDay(period.start);
    const breakEnd = minutesOfDay(period.end);
    if (breakEnd <= clock) continue;

    const workableBeforeBreak = Math.max(0, breakStart - clock);
    if (remaining <= workableBeforeBreak) {
      return timeFromMinutes(clock + remaining);
    }
    remaining -= workableBeforeBreak;
    clock = breakEnd;
  }

  return timeFromMinutes(clock + remaining);
}

/** 그 날 근무를 모두 마치는 시각. */
export function workEndTime(schedule: WorkSchedule, dailyWorkMinutes: number): LocalTime {
  return timeAfterWorkedMinutes(schedule, dailyWorkMinutes);
}
