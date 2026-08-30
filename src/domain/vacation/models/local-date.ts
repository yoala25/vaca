/**
 * 타임존에 영향받지 않는 순수 달력 날짜(LocalDate) 추상화.
 *
 * ── 라이브러리를 쓰지 않고 직접 구현한 이유 ──
 * date-fns / Luxon / Temporal polyfill은 모두 내부적으로 JS `Date`(= UTC 기준 epoch)를
 * 경유한다. 대한민국(UTC+9) 환경에서 `new Date("2026-09-25")`는 UTC 자정으로 파싱되어
 * 로컬에서는 9/25 09:00이 되고, 반대로 UTC-계열 CI에서 실행하면 하루가 밀린다.
 * 휴가 엔진은 "며칠에 쉬는가"만 다루는 순수 달력 도메인이므로, 아예 `Date` 객체를
 * 한 번도 만들지 않고 정수 연산(Howard Hinnant civil-date 알고리즘)으로 처리한다.
 * 이렇게 하면 실행 환경 타임존과 무관하게 결과가 항상 동일하다(= deterministic).
 *
 * 시스템 "오늘"을 얻을 때만 Date를 쓰며, 그 지점은 `todayInSeoul()` 하나로 격리한다.
 */

/** `YYYY-MM-DD` 형식임이 보장된 문자열 */
export type LocalDate = string & { readonly __brand: "LocalDate" };
/** `HH:mm` 형식임이 보장된 문자열 */
export type LocalTime = string & { readonly __brand: "LocalTime" };
/** `YYYY-MM-DDTHH:mm` 형식임이 보장된 문자열 */
export type LocalDateTime = string & { readonly __brand: "LocalDateTime" };

export const DayOfWeek = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
} as const;
export type DayOfWeek = (typeof DayOfWeek)[keyof typeof DayOfWeek];

export const DAY_OF_WEEK_KO: Record<DayOfWeek, string> = {
  0: "일",
  1: "월",
  2: "화",
  3: "수",
  4: "목",
  5: "금",
  6: "토",
};

export const MINUTES_PER_DAY = 1440;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

export interface CivilDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** 검증 없이 조립한다. 내부 전용. */
function formatDate(year: number, month: number, day: number): LocalDate {
  return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}` as LocalDate;
}

/**
 * 그레고리력 (y, m, d) → 1970-01-01 기준 일수.
 * Howard Hinnant, "chrono-Compatible Low-Level Date Algorithms".
 */
export function daysFromCivil(year: number, month: number, day: number): number {
  const y = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400; // [0, 399]
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

/** daysFromCivil의 역함수. */
export function civilFromDays(days: number): CivilDate {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const dayOfEra = z - era * 146097; // [0, 146096]
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) /
      365,
  );
  const year = yearOfEra + era * 400;
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const mp = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  return { year: year + (month <= 2 ? 1 : 0), month, day };
}

function isRealCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const roundTrip = civilFromDays(daysFromCivil(year, month, day));
  return roundTrip.year === year && roundTrip.month === month && roundTrip.day === day;
}

/** 외부(사용자 입력, 저장소, API)에서 들어온 문자열을 LocalDate로 승격한다. */
export function asLocalDate(value: string): LocalDate {
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new TypeError(`LocalDate must be YYYY-MM-DD, received "${value}"`);
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (!isRealCalendarDate(year, month, day)) {
    throw new RangeError(`"${value}" is not a real calendar date`);
  }
  return formatDate(year, month, day);
}

export function localDate(year: number, month: number, day: number): LocalDate {
  if (!isRealCalendarDate(year, month, day)) {
    throw new RangeError(`(${year}, ${month}, ${day}) is not a real calendar date`);
  }
  return formatDate(year, month, day);
}

export function toCivil(date: LocalDate): CivilDate {
  const match = DATE_PATTERN.exec(date);
  if (!match) throw new TypeError(`Malformed LocalDate: "${date}"`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function toEpochDay(date: LocalDate): number {
  const { year, month, day } = toCivil(date);
  return daysFromCivil(year, month, day);
}

export function fromEpochDay(days: number): LocalDate {
  const { year, month, day } = civilFromDays(days);
  return formatDate(year, month, day);
}

export function addDays(date: LocalDate, amount: number): LocalDate {
  return fromEpochDay(toEpochDay(date) + amount);
}

/** to - from (일 단위). 같은 날이면 0. */
export function differenceInDays(from: LocalDate, to: LocalDate): number {
  return toEpochDay(to) - toEpochDay(from);
}

/** 시작·끝을 모두 포함한 일수. */
export function inclusiveDayCount(start: LocalDate, end: LocalDate): number {
  return differenceInDays(start, end) + 1;
}

export function dayOfWeek(date: LocalDate): DayOfWeek {
  // 1970-01-01(epoch day 0)은 목요일(4).
  const epochDay = toEpochDay(date);
  return ((((epochDay % 7) + 4) % 7) + 7) % 7 as DayOfWeek;
}

export function isWeekend(date: LocalDate): boolean {
  const dow = dayOfWeek(date);
  return dow === DayOfWeek.Saturday || dow === DayOfWeek.Sunday;
}

export function minDate(a: LocalDate, b: LocalDate): LocalDate {
  return a <= b ? a : b;
}

export function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return a >= b ? a : b;
}

/** [start, end] 구간의 모든 날짜를 오름차순으로 열거한다. */
export function eachDayInRange(start: LocalDate, end: LocalDate): LocalDate[] {
  const result: LocalDate[] = [];
  const last = toEpochDay(end);
  for (let cursor = toEpochDay(start); cursor <= last; cursor++) {
    result.push(fromEpochDay(cursor));
  }
  return result;
}

/** `YYYY-MM` 월 키. 포트폴리오 분산 판정 등에 사용한다. */
export function monthKey(date: LocalDate): string {
  return date.slice(0, 7);
}

// ── 시각(LocalTime) ──────────────────────────────────────────────

export function asLocalTime(value: string): LocalTime {
  const match = TIME_PATTERN.exec(value);
  if (!match) throw new TypeError(`LocalTime must be HH:mm, received "${value}"`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new RangeError(`"${value}" is not a valid time`);
  return value as LocalTime;
}

export function minutesOfDay(time: LocalTime): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function timeFromMinutes(totalMinutes: number): LocalTime {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.round(totalMinutes)));
  return `${pad2(Math.floor(clamped / 60))}:${pad2(clamped % 60)}` as LocalTime;
}

export function atTime(date: LocalDate, time: LocalTime): LocalDateTime {
  return `${date}T${time}` as LocalDateTime;
}

export function startOfDay(date: LocalDate): LocalDateTime {
  return `${date}T00:00` as LocalDateTime;
}

/** 다음 날 00:00으로 표현한다(24:00 표기를 피하기 위함). */
export function endOfDay(date: LocalDate): LocalDateTime {
  return startOfDay(addDays(date, 1));
}

export function splitDateTime(value: LocalDateTime): { date: LocalDate; minutes: number } {
  const [datePart, timePart] = value.split("T");
  return {
    date: datePart as LocalDate,
    minutes: minutesOfDay(timePart as LocalTime),
  };
}

/** to - from (분 단위). */
export function differenceInMinutes(from: LocalDateTime, to: LocalDateTime): number {
  const a = splitDateTime(from);
  const b = splitDateTime(to);
  return differenceInDays(a.date, b.date) * MINUTES_PER_DAY + (b.minutes - a.minutes);
}

/** 시스템 시계를 읽는 유일한 지점. Asia/Seoul 기준 오늘 날짜를 돌려준다. */
export function todayInSeoul(now: Date = new Date()): LocalDate {
  // en-CA 로캘은 YYYY-MM-DD 형식을 보장한다.
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return asLocalDate(formatted);
}
