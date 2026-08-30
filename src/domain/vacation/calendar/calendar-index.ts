import type { DayInfo } from "../models/day-info";
import { inclusiveDayCount, type LocalDate } from "../models/local-date";

/** 자연 휴일이 연속으로 이어지는 최대 구간(주말, 연휴 등). */
export interface RestRun {
  startIndex: number;
  endIndex: number;
  startDate: LocalDate;
  endDate: LocalDate;
  dayCount: number;
}

/**
 * DayInfo[] 위에서 후보 탐색이 필요로 하는 조회를 O(1)로 만들어주는 인덱스.
 * 후보 생성기가 매번 배열을 훑지 않도록 미리 계산해 둔다.
 */
export interface CalendarIndex {
  days: DayInfo[];
  /** days[i]의 앞쪽 누적 근무 분. workMinutesBetween 계산용. */
  readonly length: number;
  indexOf(date: LocalDate): number;
  dayAt(index: number): DayInfo | undefined;
  /** [fromIndex, toIndex] 구간에서 휴가로 메워야 하는 총 근무 분. */
  workMinutesBetween(fromIndex: number, toIndex: number): number;
  /** 구간 밖은 "근무일"로 간주한다. 후보 경계 판정에 사용. */
  isWorkdayAt(index: number): boolean;
  restRuns: RestRun[];
  /** 표준 근무일 1일의 분. 일수 환산 기준. */
  standardDailyWorkMinutes: number;
}

function computeStandardDailyWorkMinutes(days: DayInfo[]): number {
  const workingMinutes = days.map((day) => day.rosterWorkMinutes).filter((minutes) => minutes > 0);
  if (workingMinutes.length === 0) return 480;
  // 가장 흔한 근무 분을 표준으로 삼는다(단축근무 예외에 흔들리지 않도록).
  const frequency = new Map<number, number>();
  for (const minutes of workingMinutes) {
    frequency.set(minutes, (frequency.get(minutes) ?? 0) + 1);
  }
  let best = workingMinutes[0];
  let bestCount = 0;
  for (const [minutes, count] of frequency) {
    if (count > bestCount || (count === bestCount && minutes > best)) {
      best = minutes;
      bestCount = count;
    }
  }
  return best;
}

function findRestRuns(days: DayInfo[]): RestRun[] {
  const runs: RestRun[] = [];
  let runStart = -1;

  for (let i = 0; i < days.length; i++) {
    const isRest = days[i].scheduledWorkMinutes === 0;
    if (isRest && runStart === -1) {
      runStart = i;
    } else if (!isRest && runStart !== -1) {
      runs.push(makeRun(days, runStart, i - 1));
      runStart = -1;
    }
  }
  if (runStart !== -1) runs.push(makeRun(days, runStart, days.length - 1));

  return runs;
}

function makeRun(days: DayInfo[], startIndex: number, endIndex: number): RestRun {
  const startDate = days[startIndex].date;
  const endDate = days[endIndex].date;
  return {
    startIndex,
    endIndex,
    startDate,
    endDate,
    dayCount: inclusiveDayCount(startDate, endDate),
  };
}

export function createCalendarIndex(days: DayInfo[]): CalendarIndex {
  const positionByDate = new Map<LocalDate, number>();
  days.forEach((day, index) => positionByDate.set(day.date, index));

  // prefix[i] = days[0..i-1]의 근무 분 합
  const prefix = new Array<number>(days.length + 1).fill(0);
  for (let i = 0; i < days.length; i++) {
    prefix[i + 1] = prefix[i] + days[i].scheduledWorkMinutes;
  }

  return {
    days,
    length: days.length,
    standardDailyWorkMinutes: computeStandardDailyWorkMinutes(days),
    restRuns: findRestRuns(days),
    indexOf: (date) => positionByDate.get(date) ?? -1,
    dayAt: (index) => (index >= 0 && index < days.length ? days[index] : undefined),
    workMinutesBetween: (fromIndex, toIndex) => {
      const from = Math.max(0, fromIndex);
      const to = Math.min(days.length - 1, toIndex);
      if (from > to) return 0;
      return prefix[to + 1] - prefix[from];
    },
    isWorkdayAt: (index) => {
      if (index < 0 || index >= days.length) return true;
      return days[index].scheduledWorkMinutes > 0;
    },
  };
}
