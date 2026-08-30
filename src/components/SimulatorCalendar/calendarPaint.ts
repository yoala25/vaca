import { eachDayInRange, type LocalDate, type VacationOverlayRange } from "../../domain/vacation";
import { holidayName } from "../../data/holidays";

export type PartialPeriod = "AM" | "PM" | "START" | "END";

export interface DayPaint {
  range?: VacationOverlayRange;
  inBand: boolean;
  isBandStart: boolean;
  isBandEnd: boolean;
  fullLeave: boolean;
  partial?: { period: PartialPeriod; minutes: number };
  /** 사용자가 달력에서 직접 찍어 추가한 휴가. */
  manual: boolean;
}

/**
 * 오버레이 + 직접 추가한 휴가를 날짜별 렌더 정보로 접는다.
 * 날짜 계산은 엔진이 끝냈으므로 여기서는 "칠하기"에 필요한 형태로만 바꾼다.
 */
export function buildPaintMap(
  ranges: VacationOverlayRange[],
  manualLeaveDates: LocalDate[] = [],
): Map<LocalDate, DayPaint> {
  const paint = new Map<LocalDate, DayPaint>();

  for (const range of ranges) {
    const fullLeave = new Set(range.leaveDates);

    for (const date of eachDayInRange(range.startDate, range.endDate)) {
      paint.set(date, {
        range,
        inBand: true,
        isBandStart: date === range.startDate,
        isBandEnd: date === range.endDate,
        fullLeave: fullLeave.has(date),
        manual: false,
      });
    }

    // 부분휴가일은 코어 바깥(앞뒤 근무일)에 붙으므로 따로 표시한다.
    for (const item of range.partialLeaveDates) {
      const existing = paint.get(item.date);
      paint.set(item.date, {
        range,
        inBand: existing?.inBand ?? false,
        isBandStart: existing?.isBandStart ?? false,
        isBandEnd: existing?.isBandEnd ?? false,
        fullLeave: existing?.fullLeave ?? false,
        partial: { period: item.period, minutes: item.minutes },
        manual: false,
      });
    }
  }

  for (const date of manualLeaveDates) {
    const existing = paint.get(date);
    paint.set(date, {
      range: existing?.range,
      inBand: existing?.inBand ?? false,
      isBandStart: existing?.isBandStart ?? false,
      isBandEnd: existing?.isBandEnd ?? false,
      fullLeave: true,
      partial: existing?.partial,
      manual: true,
    });
  }

  return paint;
}

/** 날짜 칸 아래에 붙일 짧은 라벨. 공휴일 이름이 길면 줄여 쓴다. */
export function dayLabelFor(date: LocalDate, paint: DayPaint | undefined): string | undefined {
  const holiday = holidayName(date);
  if (holiday) return shortenHolidayName(holiday);
  if (paint?.partial) {
    return paint.partial.period === "AM" || paint.partial.period === "START"
      ? "오전반차"
      : "오후반차";
  }
  if (paint?.fullLeave) return "휴가";
  return undefined;
}

function shortenHolidayName(name: string): string {
  // "삼일절 대체공휴일" → "대체휴일" 처럼 칸에 들어가는 길이로 줄인다.
  if (name.includes("대체공휴일")) return "대체휴일";
  if (name.length <= 5) return name;
  return `${name.slice(0, 4)}…`;
}
