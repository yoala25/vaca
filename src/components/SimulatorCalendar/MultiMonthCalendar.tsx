import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./MultiMonthCalendar.module.css";
import { MonthGrid, type CalendarToast } from "./MonthGrid";
import { buildPaintMap, type DayPaint } from "./calendarPaint";
import {
  isWeekend,
  localDate,
  toCivil,
  type LocalDate,
  type VacationOverlayRange,
} from "../../domain/vacation";
import { isHoliday } from "../../data/holidays";

const TOAST_DURATION_MS = 1000;

interface MultiMonthCalendarProps {
  /** 첫 번째로 보여줄 달의 1일. */
  startMonth: LocalDate;
  monthCount: number;
  onStartMonthChange?: (next: LocalDate) => void;
  ranges: VacationOverlayRange[];
  manualLeaveDates: LocalDate[];
  selectedCandidateId?: string;
  onSelectRange: (range: VacationOverlayRange) => void;
  onToggleManualDate: (date: LocalDate) => void;
  /** 추천된 휴가일을 취소한다(그 날은 더 이상 제안하지 않는다). */
  onExcludeDate: (date: LocalDate) => void;
  today: LocalDate;
  /** 근무 요일 판정(월~금 / 월~토). */
  isWorkingWeekday: (date: LocalDate) => boolean;
  /** 연차를 쓸 수 있는 마지막 날. 이후 날짜는 클릭해도 추가되지 않는다. */
  leaveExpiryDate?: LocalDate;
  compact?: boolean;
  title?: string;
  onOpenYearView?: () => void;
  yearViewLabel?: string;
}

export function MultiMonthCalendar({
  startMonth,
  monthCount,
  onStartMonthChange,
  ranges,
  manualLeaveDates,
  selectedCandidateId,
  onSelectRange,
  onToggleManualDate,
  onExcludeDate,
  today,
  isWorkingWeekday,
  leaveExpiryDate,
  compact = false,
  title,
  onOpenYearView,
  yearViewLabel,
}: MultiMonthCalendarProps) {
  const [toast, setToast] = useState<CalendarToast | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const paintMap = useMemo(
    () => buildPaintMap(ranges, manualLeaveDates),
    [ranges, manualLeaveDates],
  );

  const months = useMemo(() => {
    const { year, month } = toCivil(startMonth);
    return Array.from({ length: monthCount }, (_, i) => {
      const total = year * 12 + (month - 1) + i;
      return { year: Math.floor(total / 12), month: (total % 12) + 1 };
    });
  }, [startMonth, monthCount]);

  const shiftMonths = (delta: number) => {
    if (!onStartMonthChange) return;
    const { year, month } = toCivil(startMonth);
    const total = year * 12 + (month - 1) + delta;
    onStartMonthChange(localDate(Math.floor(total / 12), (total % 12) + 1, 1));
  };

  /** 연차를 써야만 쉴 수 있는 날인가 (= 클릭해서 휴가로 만들 수 있는가). */
  const isLeaveableDay = (date: LocalDate): boolean => {
    if (isWeekend(date) || isHoliday(date)) return false;
    if (!isWorkingWeekday(date)) return false;
    if (date < today) return false;
    if (leaveExpiryDate && date > leaveExpiryDate) return false;
    return true;
  };

  const showToast = (next: CalendarToast) => {
    window.clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
  };

  const handleDayClick = (date: LocalDate, paint: DayPaint | undefined) => {
    // 직접 추가한 휴가를 다시 누르면 되돌린다.
    if (paint?.manual) {
      onToggleManualDate(date);
      showToast({ date, text: "휴가 취소 −1", kind: "remove" });
      return;
    }
    // 추천된 휴가일(반차 포함)을 누르면 그 날은 쓰지 않는다.
    // 예산은 그대로라 엔진이 다른 날로 다시 배치한다.
    if (paint?.fullLeave || paint?.partial) {
      onExcludeDate(date);
      showToast({ date, text: "휴가 취소", kind: "remove" });
      return;
    }
    // 휴가일이 아닌, 휴식 구간에 속한 날(주말·공휴일)은 그 구간을 선택한다.
    if (paint?.range) {
      onSelectRange(paint.range);
      return;
    }
    if (isLeaveableDay(date)) {
      onToggleManualDate(date);
      showToast({ date, text: "휴가 추가 +1", kind: "add" });
    }
  };

  const headerTitle = title ?? `${toCivil(startMonth).year}년`;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.title}>{headerTitle}</span>

        <div className={styles.headerRight}>
          {onOpenYearView && (
            <button type="button" className={styles.yearBtn} onClick={onOpenYearView}>
              📅 {yearViewLabel ?? "전체보기"}
            </button>
          )}
          {onStartMonthChange && (
            <>
              <button
                type="button"
                className={styles.navBtn}
                aria-label="이전"
                onClick={() => shiftMonths(-monthCount)}
              >
                ‹
              </button>
              <button
                type="button"
                className={styles.navBtn}
                aria-label="다음"
                onClick={() => shiftMonths(monthCount)}
              >
                ›
              </button>
            </>
          )}
        </div>
      </div>

      <div className={`${styles.months} ${compact ? styles.year : ""}`}>
        {months.map(({ year, month }) => (
          <MonthGrid
            key={`${year}-${month}`}
            year={year}
            month={month}
            paintMap={paintMap}
            selectedCandidateId={selectedCandidateId}
            today={today}
            compact={compact}
            toast={toast}
            isLeaveableDay={isLeaveableDay}
            onDayClick={handleDayClick}
          />
        ))}
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendSwatch} style={{ background: "var(--color-coral)" }} />
          공휴일·주말
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendSwatch} style={{ background: "var(--color-teal)" }} />
          추천 휴가
        </span>
        <span className={styles.legendItem}>
          <span
            className={styles.legendSwatch}
            style={{
              background: "var(--color-teal-dark)",
              boxShadow: "0 0 0 2px rgba(25,136,141,0.25)",
            }}
          />
          직접 추가한 휴가
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendSwatch} style={{ background: "#cfe9e1" }} />
          이어지는 휴식 구간
        </span>
      </div>
      <p className={styles.hint}>
        평일을 누르면 휴가로 추가되고, 휴가로 표시된 날을 다시 누르면 취소돼요.
      </p>
    </div>
  );
}
