import { createCalendarIndex, type CalendarIndex } from "../calendar/calendar-index";
import { buildCalendar } from "../calendar/build-calendar";
import { generateCandidates } from "../candidates/generate-candidates";
import { createDefaultConstraints } from "../constraints/built-in-constraints";
import {
  HolidayDataStatus,
  HolidayType,
  type CompanyHoliday,
  type Holiday,
  type HolidaySet,
} from "../models/holiday";
import {
  createDefaultLeaveCatalog,
  type LeaveType,
} from "../models/leave-type";
import {
  DayOfWeek,
  addDays,
  asLocalDate,
  dayOfWeek,
  type LocalDate,
} from "../models/local-date";
import { createWorkSchedule, type WorkSchedule } from "../models/work-schedule";
import type { VacationCandidate } from "../models/vacation-candidate";
import {
  VacationStrategy,
  type VacationEngineInput,
} from "../models/vacation-plan";

/**
 * 실제 한국 공휴일에 의존하지 않는 합성 달력 (§47).
 * 공휴일 데이터가 바뀌어도 알고리즘 테스트는 깨지지 않는다.
 */

export const STANDARD_DAILY_MINUTES = 480;

/** 기준 시작일. 2030-01-01은 화요일이다(테스트에서 요일은 항상 헬퍼로 찾는다). */
export const FIXTURE_ORIGIN = asLocalDate("2030-01-01");

/** from(포함) 이후 처음 만나는 해당 요일. */
export function findDayOfWeek(from: LocalDate, target: DayOfWeek): LocalDate {
  let cursor = from;
  for (let guard = 0; guard < 14; guard++) {
    if (dayOfWeek(cursor) === target) return cursor;
    cursor = addDays(cursor, 1);
  }
  throw new Error(`Could not find day of week ${target} from ${from}`);
}

export function holiday(date: string, name = "테스트 공휴일"): Holiday {
  return { date: asLocalDate(date), name, type: HolidayType.Public };
}

export function substituteHoliday(date: string, name = "테스트 대체공휴일"): Holiday {
  return { date: asLocalDate(date), name, type: HolidayType.Substitute };
}

export function makeHolidaySet(
  holidays: Holiday[],
  from: LocalDate,
  to: LocalDate,
  dataStatus: HolidayDataStatus = HolidayDataStatus.Official,
): HolidaySet {
  return { holidays, dataStatus, coveredFrom: from, coveredTo: to };
}

export interface TestScenarioOptions {
  from?: LocalDate;
  /** 달력 길이(일). */
  days?: number;
  holidays?: Holiday[];
  companyHolidays?: CompanyHoliday[];
  annualLeaveDays?: number;
  halfDayEnabled?: boolean;
  hourlyUnitMinutes?: number | null;
  extraLeaveTypes?: LeaveType[];
  blockedDates?: LocalDate[];
  strategy?: VacationStrategy;
  includeSpecialLeave?: boolean;
  schedule?: WorkSchedule;
}

export interface TestScenario {
  index: CalendarIndex;
  candidates: VacationCandidate[];
  input: VacationEngineInput;
  schedule: WorkSchedule;
  leaveCatalog: LeaveType[];
  from: LocalDate;
  to: LocalDate;
}

/** 합성 달력 + 후보 풀을 한 번에 만들어 주는 테스트 헬퍼. */
export function makeScenario(options: TestScenarioOptions = {}): TestScenario {
  const from = options.from ?? FIXTURE_ORIGIN;
  const to = addDays(from, (options.days ?? 60) - 1);
  const schedule = options.schedule ?? createWorkSchedule();

  const annualLeaveDays = options.annualLeaveDays ?? 10;
  const leaveCatalog: LeaveType[] = [
    ...createDefaultLeaveCatalog({
      annualRemainingMinutes: annualLeaveDays * STANDARD_DAILY_MINUTES,
      halfDayEnabled: options.halfDayEnabled ?? false,
      hourlyUnitMinutes: options.hourlyUnitMinutes ?? null,
      standardDailyWorkMinutes: STANDARD_DAILY_MINUTES,
    }),
    ...(options.extraLeaveTypes ?? []),
  ];

  const holidays = makeHolidaySet(options.holidays ?? [], from, to);

  const input: VacationEngineInput = {
    dateRange: { startDate: from, endDate: to },
    workSchedule: schedule,
    holidays,
    companyHolidays: options.companyHolidays ?? [],
    leaveCatalog,
    strategy: options.strategy ?? VacationStrategy.LongBreak,
    preferences: { blockedDates: options.blockedDates },
    includeSpecialLeave: options.includeSpecialLeave,
  };

  const days = buildCalendar({
    range: input.dateRange,
    workSchedule: schedule,
    holidays,
    companyHolidays: input.companyHolidays,
    blockedDates: options.blockedDates,
  });
  const index = createCalendarIndex(days);

  const candidates = generateCandidates({
    index,
    schedule,
    leaveCatalog,
    annualLeaveRemainingMinutes: annualLeaveDays * STANDARD_DAILY_MINUTES,
    constraints: createDefaultConstraints(),
    blockedDates: new Set(options.blockedDates ?? []),
    includeSpecialLeave: options.includeSpecialLeave,
  });

  return { index, candidates, input, schedule, leaveCatalog, from, to };
}

/** 정확히 이 구간을 커버하는 후보를 찾는다. */
export function findCandidate(
  candidates: VacationCandidate[],
  startDate: LocalDate,
  endDate: LocalDate,
): VacationCandidate | undefined {
  return candidates.find(
    (candidate) => candidate.startDate === startDate && candidate.endDate === endDate,
  );
}

/** 지정한 구간을 커버하면서 종일 연차만 사용하는 후보. */
export function findFullDayCandidate(
  candidates: VacationCandidate[],
  startDate: LocalDate,
  endDate: LocalDate,
): VacationCandidate | undefined {
  return candidates.find(
    (candidate) =>
      candidate.startDate === startDate &&
      candidate.endDate === endDate &&
      candidate.partialMetrics === undefined,
  );
}

export const MONDAY = DayOfWeek.Monday;
export const TUESDAY = DayOfWeek.Tuesday;
export const WEDNESDAY = DayOfWeek.Wednesday;
export const THURSDAY = DayOfWeek.Thursday;
export const FRIDAY = DayOfWeek.Friday;
export const SATURDAY = DayOfWeek.Saturday;
export const SUNDAY = DayOfWeek.Sunday;
