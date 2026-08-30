import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import pageStyles from "../../styles/pageHeader.module.css";
import styles from "./YearCalendarPage.module.css";
import { usePlanner } from "../../state/PlannerContext";
import { MultiMonthCalendar } from "../../components/SimulatorCalendar/MultiMonthCalendar";
import { StrategyTabs } from "../../components/StrategyTabs/StrategyTabs";
import { useWorkingWeekday } from "../../lib/useWorkingWeekday";
import { describeLeaveExpiry } from "../../data/companyPolicy";
import { formatDateRange, localDate, toCivil } from "../../domain/vacation";

/**
 * 1년치 휴가 배치를 한눈에 보는 화면.
 * 휴가 설계는 한 달 단위보다 "올해 전체를 어떻게 나눌까"로 판단하는 경우가 많다.
 */
export function YearCalendarPage() {
  const navigate = useNavigate();
  const {
    result,
    today,
    leaveExpiryDate,
    strategy,
    setStrategy,
    manualLeaveDates,
    toggleManualLeaveDate,
    excludeDate,
    companyPolicy,
  } = usePlanner();

  const isWorkingWeekday = useWorkingWeekday();
  const [year, setYear] = useState(() => toCivil(today).year);
  const ranges = result.calendarOverlay.ranges;

  const yearRanges = useMemo(
    () =>
      ranges.filter(
        (range) =>
          toCivil(range.startDate).year === year || toCivil(range.endDate).year === year,
      ),
    [ranges, year],
  );

  const expiryYear = toCivil(leaveExpiryDate).year;

  return (
    <div className={pageStyles.page}>
      <div>
        <h1 className={pageStyles.title}>전체 캘린더</h1>
        <p className={pageStyles.desc}>
          {describeLeaveExpiry(companyPolicy, today)}까지의 휴가 배치를 1년 단위로 확인하세요.
        </p>
      </div>

      <StrategyTabs value={strategy} onChange={setStrategy} />

      <div className={styles.yearNav}>
        <button
          type="button"
          className={styles.yearNavBtn}
          onClick={() => setYear((value) => value - 1)}
          aria-label="이전 해"
        >
          ‹
        </button>
        <span className={styles.yearLabel}>{year}년</span>
        <button
          type="button"
          className={styles.yearNavBtn}
          onClick={() => setYear((value) => value + 1)}
          aria-label="다음 해"
          disabled={year >= expiryYear}
        >
          ›
        </button>
        <button type="button" className={styles.backBtn} onClick={() => navigate("/")}>
          4개월 보기로 돌아가기
        </button>
      </div>

      <MultiMonthCalendar
        startMonth={localDate(year, 1, 1)}
        monthCount={12}
        ranges={ranges}
        manualLeaveDates={manualLeaveDates}
        onSelectRange={() => navigate("/")}
        onToggleManualDate={toggleManualLeaveDate}
        onExcludeDate={excludeDate}
        today={today}
        isWorkingWeekday={isWorkingWeekday}
        leaveExpiryDate={leaveExpiryDate}
        compact
        title={`${year}년 전체`}
      />

      <section className={styles.summary}>
        <p className={styles.summaryTitle}>
          {year}년 추천 휴가 {yearRanges.length}건 · 총 {result.summary.totalRestDays}일 휴식
        </p>
        <div className={styles.chips}>
          {yearRanges.map((range) => (
            <span key={range.candidateId} className={styles.chip}>
              <span>{range.emoji}</span>
              <span className={styles.chipLabel}>{range.label}</span>
              <span className={styles.chipMeta}>
                {formatDateRange(range.startDate, range.endDate)} · {range.totalRestDays}일
              </span>
            </span>
          ))}
          {yearRanges.length === 0 && (
            <span className={styles.chipMeta}>이 해에는 추천된 휴가가 없어요.</span>
          )}
        </div>
      </section>
    </div>
  );
}
