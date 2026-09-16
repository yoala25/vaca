import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import pageStyles from "../../styles/pageHeader.module.css";
import styles from "./YearCalendarPage.module.css";
import { usePlanner } from "../../state/PlannerContext";
import { MultiMonthCalendar } from "../../components/SimulatorCalendar/MultiMonthCalendar";
import { StrategyTabs, STRATEGY_TABS } from "../../components/StrategyTabs/StrategyTabs";
import { useWorkingWeekday } from "../../lib/useWorkingWeekday";
import { describeLeaveExpiry } from "../../data/companyPolicy";
import { track } from "../../features/analytics";
import {
  formatDateRange,
  localDate,
  toCivil,
  type LocalDate,
  type VacationStrategy,
} from "../../domain/vacation";

/**
 * 달력 보기.
 *
 * 1년치 휴가 배치를 달로 훑어보면서, 위에 고정된 전략 버튼을 눌러
 * "지금 보고 있는 달"이 전략에 따라 어떻게 달라지는지 바로 비교하는 화면이다.
 * 그래서 전략을 바꿔도 보던 달을 유지한다(달력을 첫 추천으로 끌고 가지 않는다).
 */
export function YearCalendarPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    result,
    today,
    leaveExpiryDate,
    strategy,
    setStrategy,
    manualLeaveDates,
    toggleManualLeaveDate,
    clearManualLeaveDates,
    excludedDates,
    excludeDate,
    clearExcludedDates,
    savedRanges,
    toggleSavedRange,
    isRangeSaved,
    availableLeaveDays,
    companyPolicy,
    selectedYear,
    currentYear,
    isFutureYear,
  } = usePlanner();

  const isWorkingWeekday = useWorkingWeekday();
  // 홈에서 보던 연도를 그대로 이어받는다.
  const [year, setYear] = useState(selectedYear);
  useEffect(() => setYear(selectedYear), [selectedYear]);

  const ranges = result.calendarOverlay.ranges;
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const selected = useMemo(
    () => ranges.find((range) => range.candidateId === selectedId),
    [ranges, selectedId],
  );

  const yearRanges = useMemo(
    () =>
      ranges.filter(
        (range) =>
          toCivil(range.startDate).year === year || toCivil(range.endDate).year === year,
      ),
    [ranges, year],
  );

  const expiryYear = toCivil(leaveExpiryDate).year;
  // 추천은 선택 연도 안에서만 계산되므로 그 밖으로는 넘어가지 않게 한다.
  const minYear = Math.min(selectedYear, currentYear);

  /** 해당 달이 화면에 오도록 스크롤한다(달력 각 달에 data-month 가 붙어 있다). */
  const scrollToMonth = useCallback((target: { year: number; month: number }) => {
    const el = document.querySelector(`[data-month="${target.year}-${target.month}"]`);
    el?.scrollIntoView({ block: "start", behavior: "auto" });
  }, []);

  /*
   * 들어오자마자 오늘이 있는 달부터 보여 준다.
   * TOP3·레이더에서 특정 날짜를 눌러 들어왔으면 그 달을 대신 펼친다.
   * 미래 연도처럼 오늘이 그 해에 없으면 1월부터 본다.
   */
  const focusDate = (location.state as { focusDate?: LocalDate } | null)?.focusDate;
  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (didInitialScroll.current) return;
    didInitialScroll.current = true;

    const target = focusDate ? toCivil(focusDate) : toCivil(today);
    const month = target.year === year ? target.month : 1;
    // 달력이 그려진 뒤에 옮긴다.
    const timer = window.setTimeout(() => scrollToMonth({ year, month }), 60);
    return () => window.clearTimeout(timer);
  }, [focusDate, today, year, scrollToMonth]);

  const changeYear = (next: number) => {
    setYear(next);
    // 연도를 바꾸면 그 해의 처음(올해면 이번 달)부터 다시 본다.
    const month = next === currentYear ? toCivil(today).month : 1;
    window.setTimeout(() => scrollToMonth({ year: next, month }), 60);
  };

  const changeStrategy = (next: VacationStrategy) => {
    // 보고 있던 달을 그대로 둔다. 여기서 달력을 옮기면 무엇이 달라졌는지 비교할 수 없다.
    setStrategy(next);
    track("vacation_style_select", { targetYear: year, vacationStyle: next });
  };

  const strategyDescription =
    STRATEGY_TABS.find((tab) => tab.id === strategy)?.description ?? "";

  const manualLeaveCount = manualLeaveDates.length;
  const budgetExceeded = availableLeaveDays === 0 && manualLeaveCount > 0;

  return (
    <div className={pageStyles.page}>
      <div>
        <h1 className={pageStyles.title}>달력 보기</h1>
        <p className={pageStyles.desc}>
          {isFutureYear
            ? `${selectedYear}년 휴가 배치를 미리 확인하세요.`
            : `${describeLeaveExpiry(companyPolicy, today)}까지의 휴가 배치를 확인하세요.`}
        </p>
      </div>

      {/* 스크롤해도 따라오는 전략 버튼. 보고 있는 달에서 바로 비교할 수 있다. */}
      <div className={styles.strategyBar}>
        <StrategyTabs value={strategy} onChange={changeStrategy} hideDescription />
        <p className={styles.strategyDescription}>{strategyDescription}</p>
      </div>

      <div className={styles.yearNav}>
        <button
          type="button"
          className={styles.yearNavBtn}
          onClick={() => changeYear(Math.max(minYear, year - 1))}
          aria-label="이전 해"
          disabled={year <= minYear}
        >
          ‹
        </button>
        <span className={styles.yearLabel}>{year}년</span>
        <button
          type="button"
          className={styles.yearNavBtn}
          onClick={() => changeYear(Math.min(expiryYear, year + 1))}
          aria-label="다음 해"
          disabled={year >= expiryYear}
        >
          ›
        </button>
        {year === currentYear && (
          <button
            type="button"
            className={styles.todayBtn}
            onClick={() => scrollToMonth({ year, month: toCivil(today).month })}
          >
            오늘로
          </button>
        )}
        <button type="button" className={styles.backBtn} onClick={() => navigate("/")}>
          휴가 설계로 돌아가기
        </button>
      </div>

      <MultiMonthCalendar
        startMonth={localDate(year, 1, 1)}
        monthCount={12}
        ranges={ranges}
        manualLeaveDates={manualLeaveDates}
        selectedCandidateId={selected?.candidateId}
        onSelectRange={(range) => setSelectedId(range.candidateId)}
        onToggleManualDate={toggleManualLeaveDate}
        onExcludeDate={excludeDate}
        today={today}
        isWorkingWeekday={isWorkingWeekday}
        leaveExpiryDate={leaveExpiryDate}
        compact
        title={`${year}년 전체`}
      />

      {selected && (
        <div className={styles.selectedBar}>
          <span className={styles.selectedEmoji}>{selected.emoji}</span>
          <div className={styles.selectedBody}>
            <p className={styles.selectedLabel}>{selected.label}</p>
            <p className={styles.selectedHeadline}>{selected.headline}</p>
            <p className={styles.selectedRange}>
              {formatDateRange(selected.startDate, selected.endDate)} · 휴가효율{" "}
              {selected.efficiency}x
            </p>
          </div>
          <button
            type="button"
            className={`${styles.saveBtn} ${
              isRangeSaved(selected.candidateId) ? styles.saveBtnActive : ""
            }`}
            onClick={() => {
              toggleSavedRange(selected);
              if (!isRangeSaved(selected.candidateId)) {
                track("save_combination", {
                  targetYear: year,
                  leaveDays: selected.leaveUsedDays,
                  resultDays: selected.totalRestDays,
                  vacationStyle: strategy,
                });
              }
            }}
          >
            {isRangeSaved(selected.candidateId) ? "저장됨 ♥" : "이 조합 저장"}
          </button>
        </div>
      )}

      {(manualLeaveCount > 0 || excludedDates.length > 0 || budgetExceeded) && (
        <div className={styles.editRow}>
          {manualLeaveCount > 0 && (
            <button type="button" className={styles.clearBtn} onClick={clearManualLeaveDates}>
              직접 추가한 휴가 {manualLeaveCount}일 모두 지우기
            </button>
          )}
          {excludedDates.length > 0 && (
            <button type="button" className={styles.clearBtn} onClick={clearExcludedDates}>
              취소한 추천 {excludedDates.length}일 되살리기
            </button>
          )}
          {budgetExceeded && (
            <p className={styles.warn}>
              직접 추가한 휴가가 남은 연차를 모두 사용했어요. 추천을 보려면 일부를 지워주세요.
            </p>
          )}
        </div>
      )}

      <section className={styles.summary}>
        <p className={styles.summaryTitle}>
          {year}년 추천 휴가 {yearRanges.length}건 · 총 {result.summary.totalRestDays}일 휴식
        </p>
        <div className={styles.chips}>
          {yearRanges.map((range) => (
            <button
              key={range.candidateId}
              type="button"
              className={`${styles.chip} ${
                range.candidateId === selected?.candidateId ? styles.chipActive : ""
              }`}
              onClick={() => {
                setSelectedId(range.candidateId);
                const { year: y, month } = toCivil(range.startDate);
                scrollToMonth({ year: y, month });
              }}
            >
              <span>{range.emoji}</span>
              <span className={styles.chipLabel}>{range.label}</span>
              <span className={styles.chipMeta}>
                {formatDateRange(range.startDate, range.endDate)} · {range.totalRestDays}일
              </span>
            </button>
          ))}
          {yearRanges.length === 0 && (
            <span className={styles.chipMeta}>이 해에는 추천된 휴가가 없어요.</span>
          )}
        </div>
      </section>

      {savedRanges.length > 0 && (
        <p className={styles.savedHint}>
          찜한 휴가 {savedRanges.length}건은 아래 <strong>찜한휴가</strong> 메뉴에서 볼 수 있어요.
        </p>
      )}
    </div>
  );
}
