import type { DayInfo } from "../models/day-info";
import { HolidayType, type CompanyHoliday, type HolidaySet } from "../models/holiday";
import {
  addDays,
  dayOfWeek,
  differenceInDays,
  eachDayInRange,
  isWeekend,
  localDate,
  toCivil,
  type LocalDate,
} from "../models/local-date";
import { rosterWorkMinutes, type WorkSchedule } from "../models/work-schedule";
import type { DateRange } from "../models/vacation-plan";

interface ResolvedHoliday {
  name: string;
  isSubstitute: boolean;
}

/**
 * 공휴일 목록을 날짜별 맵으로 접는다.
 * 같은 날짜에 여러 레코드가 들어와도 휴식을 중복 계산하지 않는다 (TEST 20).
 * 이름은 중복 없이 합치고, 하나라도 대체공휴일이면 대체공휴일로 표시한다.
 */
export function indexHolidays(holidays: HolidaySet["holidays"]): Map<LocalDate, ResolvedHoliday> {
  const index = new Map<LocalDate, ResolvedHoliday>();
  for (const holiday of holidays) {
    const existing = index.get(holiday.date);
    const isSubstitute = holiday.type === HolidayType.Substitute;
    if (!existing) {
      index.set(holiday.date, { name: holiday.name, isSubstitute });
      continue;
    }
    const names = existing.name.split(", ");
    if (!names.includes(holiday.name)) names.push(holiday.name);
    index.set(holiday.date, {
      name: names.join(", "),
      isSubstitute: existing.isSubstitute || isSubstitute,
    });
  }
  return index;
}

/** 회사 지정 휴무일을 날짜별 맵으로 펼친다. recurring이면 매년 같은 월/일에 반복된다. */
export function expandCompanyHolidays(
  companyHolidays: CompanyHoliday[],
  range: DateRange,
): Map<LocalDate, string> {
  const index = new Map<LocalDate, string>();
  const firstYear = toCivil(range.startDate).year;
  const lastYear = toCivil(range.endDate).year;

  for (const holiday of companyHolidays) {
    const occurrences: { start: LocalDate; end: LocalDate }[] = [];

    if (!holiday.recurring) {
      occurrences.push({ start: holiday.startDate, end: holiday.endDate });
    } else {
      const source = toCivil(holiday.startDate);
      const spanDays = Math.max(0, differenceInDays(holiday.startDate, holiday.endDate));
      for (let year = firstYear; year <= lastYear; year++) {
        // 2월 29일처럼 그 해에 존재하지 않는 날짜는 건너뛴다.
        try {
          const start = localDate(year, source.month, source.day);
          occurrences.push({ start, end: addDays(start, spanDays) });
        } catch {
          continue;
        }
      }
    }

    for (const occurrence of occurrences) {
      for (const date of eachDayInRange(occurrence.start, occurrence.end)) {
        if (date < range.startDate || date > range.endDate) continue;
        if (!index.has(date)) index.set(date, holiday.name);
      }
    }
  }

  return index;
}

export interface BuildCalendarOptions {
  range: DateRange;
  workSchedule: WorkSchedule;
  holidays: HolidaySet;
  companyHolidays?: CompanyHoliday[];
  blockedDates?: LocalDate[];
}

/**
 * 구간 내 모든 날짜를 DayInfo로 정규화한다.
 * 이 함수를 지난 뒤로는 "무엇이 휴일인가"를 다시 판단하지 않는다.
 */
export function buildCalendar(options: BuildCalendarOptions): DayInfo[] {
  const holidayIndex = indexHolidays(options.holidays.holidays);
  const companyIndex = expandCompanyHolidays(options.companyHolidays ?? [], options.range);
  const blocked = new Set(options.blockedDates ?? []);

  return eachDayInRange(options.range.startDate, options.range.endDate).map((date) => {
    const civil = toCivil(date);
    const dow = dayOfWeek(date);
    const weekend = isWeekend(date);
    const holiday = holidayIndex.get(date);
    const companyHolidayName = companyIndex.get(date);

    const roster = rosterWorkMinutes(options.workSchedule, date, dow);
    const isNaturalRest = weekend || holiday !== undefined || companyHolidayName !== undefined;
    const scheduledWorkMinutes = isNaturalRest ? 0 : roster;

    return {
      date,
      year: civil.year,
      month: civil.month,
      day: civil.day,
      dayOfWeek: dow,
      isWeekend: weekend,
      isPublicHoliday: holiday !== undefined,
      publicHolidayName: holiday?.name,
      isSubstituteHoliday: holiday?.isSubstitute ?? false,
      isCompanyHoliday: companyHolidayName !== undefined,
      companyHolidayName,
      isUserBlockedDate: blocked.has(date),
      isScheduledWorkday: scheduledWorkMinutes > 0,
      scheduledWorkMinutes,
      mandatoryWorkMinutes: scheduledWorkMinutes,
      naturalRestMinutes: roster - scheduledWorkMinutes,
      rosterWorkMinutes: roster,
    } satisfies DayInfo;
  });
}
