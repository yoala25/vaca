import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Home.module.css";
import { StartPanel } from "./StartPanel";
import { usePlanner } from "../../state/PlannerContext";
import { MultiMonthCalendar } from "../../components/SimulatorCalendar/MultiMonthCalendar";
import { StrategyTabs } from "../../components/StrategyTabs/StrategyTabs";
import { useWorkingWeekday } from "../../lib/useWorkingWeekday";
import { slothHammock } from "../../assets/mascot";
import { describeLeaveExpiry } from "../../data/companyPolicy";
import {
  HolidayDataStatus,
  formatDateRange,
  localDate,
  toCivil,
  type LocalDate,
  type VacationOverlayRange,
} from "../../domain/vacation";

/** 기본 달력은 4개월을 한 번에 보여준다(휴가 설계는 한 달 단위로는 판단이 안 되므로). */
const DEFAULT_MONTH_COUNT = 4;

function startOfMonth(date: LocalDate): LocalDate {
  const { year, month } = toCivil(date);
  return localDate(year, month, 1);
}

export function Home() {
  const navigate = useNavigate();
  const planner = usePlanner();
  const {
    hasCalculated,
    strategy,
    setStrategy,
    remainingLeaveDays,
    totalLeaveDays: totalLeave,
    availableLeaveDays,
    setRemainingLeaveDays,
    result,
    today,
    leaveExpiryDate,
    manualLeaveDates,
    toggleManualLeaveDate,
    clearManualLeaveDates,
    excludedDates,
    excludeDate,
    clearExcludedDates,
    toggleSavedRange,
    isRangeSaved,
    companyPolicy,
  } = planner;

  const ranges = result.calendarOverlay.ranges;
  const isWorkingWeekday = useWorkingWeekday();
  const [startMonth, setStartMonth] = useState<LocalDate>(() => startOfMonth(today));
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  /*
   * 전략을 바꿀 때만 첫 추천이 있는 달로 달력을 옮긴다.
   * ranges가 바뀔 때마다 옮기면, 사용자가 날짜를 눌러 휴가를 추가/취소하는 순간
   * 보고 있던 달이 튀어 버리고 방금 누른 칸도 사라진다.
   */
  useEffect(() => {
    const first = ranges[0];
    setSelectedId(first?.candidateId);
    if (first) setStartMonth(startOfMonth(first.startDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy]);

  const selected = useMemo(
    () => ranges.find((range) => range.candidateId === selectedId) ?? ranges[0],
    [ranges, selectedId],
  );

  if (!hasCalculated) return <StartPanel />;

  const handleSelect = (range: VacationOverlayRange) => {
    setSelectedId(range.candidateId);
    setStartMonth(startOfMonth(range.startDate));
  };

  const expiryYear = toCivil(leaveExpiryDate).year;
  const manualLeaveCount = manualLeaveDates.length;
  const budgetExceeded = availableLeaveDays === 0 && manualLeaveCount > 0;

  return (
    <div className={styles.page}>
      <div className={styles.greeting}>
        <div>
          <p className={styles.hello}>안녕하세요 👋</p>
          <h1 className={styles.title}>올해도 잘 쉬어볼까요?</h1>
        </div>

        <label className={styles.leaveBox}>
          <span className={styles.leaveLabel}>
            전체 휴가 <strong>{totalLeave}일</strong> 중
          </span>
          <input
            className={styles.leaveInput}
            type="number"
            min={0}
            max={90}
            step={0.5}
            value={remainingLeaveDays}
            onChange={(event) => setRemainingLeaveDays(Number(event.target.value))}
            aria-label="남은 연차 일수"
          />
          <span className={styles.leaveUnit}>일 남음</span>
        </label>
      </div>

      <p className={styles.expiryNote}>
        🗓️ <strong>{describeLeaveExpiry(companyPolicy, today)}</strong>까지 쓸 수 있는 연차 기준으로
        계산했어요.
        <button type="button" className={styles.inlineLink} onClick={() => navigate("/company")}>
          소멸일 변경
        </button>
      </p>

      <StrategyTabs value={strategy} onChange={setStrategy} />

      {result.summary.holidayDataStatus !== HolidayDataStatus.Official && (
        <p className={styles.notice}>
          일부 기간은 공휴일 일정이 확정되지 않았어요. 확정 후 추천이 바뀔 수 있어요.
        </p>
      )}

      <div className={styles.layout}>
        <div className={styles.calendarCol}>
          <MultiMonthCalendar
            startMonth={startMonth}
            monthCount={DEFAULT_MONTH_COUNT}
            onStartMonthChange={setStartMonth}
            ranges={ranges}
            manualLeaveDates={manualLeaveDates}
            selectedCandidateId={selected?.candidateId}
            onSelectRange={handleSelect}
            onToggleManualDate={toggleManualLeaveDate}
            onExcludeDate={excludeDate}
            today={today}
            isWorkingWeekday={isWorkingWeekday}
            leaveExpiryDate={leaveExpiryDate}
            title={`${toCivil(startMonth).year}년 휴가 배치`}
            onOpenYearView={() => navigate("/calendar")}
            yearViewLabel={`${expiryYear}년 전체보기`}
          />

          {selected && (
            <div className={styles.resultBar}>
              <span className={styles.resultEmoji}>{selected.emoji}</span>
              <div className={styles.resultBody}>
                <p className={styles.resultLabel}>{selected.label}</p>
                <p className={styles.resultHeadline}>{selected.headline}</p>
                <p className={styles.resultRange}>
                  {formatDateRange(selected.startDate, selected.endDate)} · 휴가효율{" "}
                  {selected.efficiency}x
                </p>
              </div>
              <button
                type="button"
                className={`${styles.saveBtn} ${
                  isRangeSaved(selected.candidateId) ? styles.saveBtnActive : ""
                }`}
                onClick={() => toggleSavedRange(selected)}
              >
                {isRangeSaved(selected.candidateId) ? "저장됨 ♥" : "이 조합 저장"}
              </button>
            </div>
          )}
        </div>

        <aside className={styles.sideCol}>
          <section className={styles.card}>
            <p className={styles.cardTitle}>이 전략의 결과</p>
            <div className={styles.summaryRow}>
              <span>추천 연차</span>
              <span className={styles.summaryValue}>{result.summary.leaveDaysUsed}일</span>
            </div>
            {manualLeaveCount > 0 && (
              <div className={styles.summaryRow}>
                <span>직접 추가</span>
                <span className={styles.summaryValue}>{manualLeaveCount}일</span>
              </div>
            )}
            <div className={styles.summaryRow}>
              <span>총 휴식</span>
              <span className={`${styles.summaryValue} ${styles.summaryHighlight}`}>
                {result.summary.totalRestDays}일
              </span>
            </div>
            <div className={styles.summaryRow}>
              <span>휴가 효율</span>
              <span className={styles.summaryValue}>{result.summary.efficiency}x</span>
            </div>
            <div className={styles.summaryRow}>
              <span>남는 연차</span>
              <span className={styles.summaryValue}>
                {Math.round(
                  (result.summary.remainingLeaveMinutes / companyPolicy.dailyWorkMinutes) * 10,
                ) / 10}
                일
              </span>
            </div>

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
          </section>

          <section className={styles.card}>
            <p className={styles.cardTitle}>
              추천 조합 {ranges.length > 0 && `(${ranges.length})`}
            </p>
            {ranges.length === 0 ? (
              <div className={styles.empty}>
                <img className={styles.emptyMascot} src={slothHammock} alt="" />
                <p className={styles.emptyText}>추천할 조합이 없어요</p>
                <p className={styles.emptyHint}>
                  남은 연차를 1일 이상으로 입력하거나, 연차 소멸일을 확인해 주세요.
                </p>
              </div>
            ) : (
              <div className={styles.blockList}>
                {ranges.map((range) => (
                  <button
                    key={range.candidateId}
                    type="button"
                    className={`${styles.blockItem} ${
                      range.candidateId === selected?.candidateId ? styles.blockItemActive : ""
                    }`}
                    onClick={() => handleSelect(range)}
                  >
                    <span className={styles.blockEmoji}>{range.emoji}</span>
                    <span className={styles.blockBody}>
                      <span className={styles.blockLabel}>{range.label}</span>
                      <span className={styles.blockMeta}>
                        {formatDateRange(range.startDate, range.endDate)} · 연차{" "}
                        {range.leaveUsedDays}일
                      </span>
                    </span>
                    <span className={styles.blockRest}>{range.totalRestDays}일</span>
                  </button>
                ))}
              </div>
            )}

            <button type="button" className={styles.policyLink} onClick={() => navigate("/company")}>
              회사 휴가제도 반영하기 ›
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
