import styles from "./MonthGrid.module.css";
import {
  addDays,
  dayOfWeek,
  eachDayInRange,
  localDate,
  toCivil,
  type LocalDate,
} from "../../domain/vacation";
import { holidayName, isHoliday } from "../../data/holidays";
import { dayLabelFor, type DayPaint } from "./calendarPaint";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export interface CalendarToast {
  date: LocalDate;
  text: string;
  kind: "add" | "remove";
}

interface MonthGridProps {
  year: number;
  month: number;
  paintMap: Map<LocalDate, DayPaint>;
  selectedCandidateId?: string;
  today: LocalDate;
  compact?: boolean;
  toast?: CalendarToast | null;
  /** 그 날 연차를 써야만 쉴 수 있는지(주말·공휴일이면 false). */
  isLeaveableDay: (date: LocalDate) => boolean;
  onDayClick: (date: LocalDate, paint: DayPaint | undefined) => void;
}

export function MonthGrid({
  year,
  month,
  paintMap,
  selectedCandidateId,
  today,
  compact = false,
  toast,
  isLeaveableDay,
  onDayClick,
}: MonthGridProps) {
  const firstOfMonth = localDate(year, month, 1);
  const gridStart = addDays(firstOfMonth, -dayOfWeek(firstOfMonth));
  const cells = eachDayInRange(gridStart, addDays(gridStart, 41));

  return (
    <div className={`${styles.month} ${compact ? styles.compact : ""}`}>
      <p className={styles.monthTitle}>{month}월</p>

      <div className={styles.grid}>
        {WEEKDAYS.map((label, i) => (
          <span
            key={label}
            className={`${styles.weekday} ${i === 0 ? styles.sun : ""} ${i === 6 ? styles.sat : ""}`}
          >
            {label}
          </span>
        ))}

        {cells.map((date) => {
          const civil = toCivil(date);
          if (civil.month !== month) {
            return <span key={date} className={`${styles.cell} ${styles.outside}`} />;
          }

          const weekday = dayOfWeek(date);
          const holiday = isHoliday(date);
          const paint = paintMap.get(date);
          const selected = paint?.range?.candidateId === selectedCandidateId;
          const marksLeave = Boolean(paint?.fullLeave || paint?.partial);
          const label = compact ? undefined : dayLabelFor(date, paint);
          const clickable = Boolean(paint?.range) || isLeaveableDay(date);

          const cellClass = [
            styles.cell,
            date === today ? styles.today : "",
            holiday && !marksLeave ? styles.holidayText : "",
            weekday === 0 && !marksLeave && !holiday ? styles.sun : "",
            weekday === 6 && !marksLeave && !holiday ? styles.sat : "",
            marksLeave ? styles.leaveText : "",
          ]
            .filter(Boolean)
            .join(" ");

          const labelClass = [
            styles.label,
            holiday ? styles.holidayLabel : "",
            marksLeave && !holiday ? styles.leaveLabel : "",
          ]
            .filter(Boolean)
            .join(" ");

          const title = holiday
            ? holidayName(date)
            : paint?.manual
              ? "직접 추가한 휴가 · 클릭하면 취소돼요"
              : marksLeave
                ? "추천 휴가 · 클릭하면 이 날은 빼고 다시 계산해요"
                : paint?.range
                  ? `${paint.range.label} · ${paint.range.headline}`
                  : isLeaveableDay(date)
                    ? "클릭하면 휴가로 추가돼요"
                    : undefined;

          return (
            <button
              key={date}
              type="button"
              className={cellClass}
              title={title}
              disabled={!clickable}
              onClick={() => onDayClick(date, paint)}
            >
              {toast?.date === date && (
                <span
                  className={`${styles.toast} ${toast.kind === "remove" ? styles.toastRemove : ""}`}
                >
                  {toast.text}
                </span>
              )}
              {paint?.inBand && (
                <span
                  className={[
                    styles.band,
                    paint.isBandStart || weekday === 0 ? styles.bandStart : "",
                    paint.isBandEnd || weekday === 6 ? styles.bandEnd : "",
                    selected ? styles.bandSelected : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              )}
              <span className={styles.dayTop}>
                {paint?.fullLeave && (
                  <span
                    className={`${styles.leaveDot} ${paint.manual ? styles.manualDot : ""}`}
                  />
                )}
                {paint?.partial && !paint.fullLeave && (
                  <span
                    className={`${styles.leaveDot} ${
                      paint.partial.period === "AM" || paint.partial.period === "START"
                        ? styles.partialDotEnd
                        : styles.partialDot
                    }`}
                  />
                )}
                <span className={styles.number}>{civil.day}</span>
              </span>
              {label && <span className={labelClass}>{label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
