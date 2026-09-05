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
import { MascotMessage } from "../../features/highlights/MascotMessage";
import { track } from "../../features/analytics";
import { YearBar } from "../../features/wallet/YearBar";
import { LeaveWalletPanel } from "../../features/wallet/LeaveWalletPanel";
import { FutureYearSetup } from "../../features/wallet/FutureYearSetup";
import { NextYearCta } from "../../features/wallet/NextYearCta";
import { TopChances } from "../../features/highlights/TopChances";
import { VacationRadar } from "../../features/highlights/VacationRadar";
import {
  pickTopChances,
  scoreAllCandidates,
  describeCandidate,
  type VacationChance,
} from "../../features/highlights/vacationRanking";
import {
  annotateHighlights,
  buildMonthlyRadar,
  type MonthRadar,
} from "../../features/highlights/monthlyVacationRadar";
import { moodForScore, pickMascotMessage } from "../../features/highlights/mascotMessages";
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

function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return a >= b ? a : b;
}

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
    savedRanges,
    toggleSavedRange,
    isRangeSaved,
    companyPolicy,
    selectedYear,
    currentYear,
    isFutureYear,
    leaveEntryType,
    needsLeaveInput,
  } = planner;

  const ranges = result.calendarOverlay.ranges;
  const isWorkingWeekday = useWorkingWeekday();
  const [startMonth, setStartMonth] = useState<LocalDate>(() => startOfMonth(today));
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [walletOpen, setWalletOpen] = useState(false);

  /*
   * 전략을 바꿀 때만 첫 추천이 있는 달로 달력을 옮긴다.
   * ranges가 바뀔 때마다 옮기면, 사용자가 날짜를 눌러 휴가를 추가/취소하는 순간
   * 보고 있던 달이 튀어 버리고 방금 누른 칸도 사라진다.
   */
  useEffect(() => {
    const first = ranges[0];
    setSelectedId(first?.candidateId);
    if (first) {
      setStartMonth(startOfMonth(first.startDate));
    } else {
      // 추천이 없어도 달력은 선택한 연도 안에 머물러야 한다.
      setStartMonth(startOfMonth(maxDate(localDate(selectedYear, 1, 1), today)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy, selectedYear]);

  const selected = useMemo(
    () => ranges.find((range) => range.candidateId === selectedId) ?? ranges[0],
    [ranges, selectedId],
  );

  /*
   * TOP3 · 효율점수 · 레이더는 모두 엔진이 이미 만든 후보 풀(rankedCandidates)에서 파생된다.
   * 휴가 계산을 다시 하지 않으므로 기존 추천 결과와 절대 어긋나지 않는다.
   */
  const scoredEntries = useMemo(
    () => scoreAllCandidates(result.rankedCandidates),
    [result.rankedCandidates],
  );
  const topChances = useMemo(() => pickTopChances(scoredEntries), [scoredEntries]);
  const radarYear = selectedYear;
  const radar = useMemo(
    () => annotateHighlights(buildMonthlyRadar(scoredEntries, radarYear)),
    [scoredEntries, radarYear],
  );

  const bestScore = topChances[0]?.score.score ?? 0;
  const mascotText = useMemo(
    () =>
      pickMascotMessage({
        mood: moodForScore(bestScore, topChances.length, isFutureYear),
        seed: `${selectedYear}:${strategy}:${remainingLeaveDays}:${scoredEntries.length}:${topChances[0]?.candidate.id ?? "none"}`,
        leaveDays: topChances[0]?.leaveDays,
        restDays: topChances[0]?.restDays,
        count: scoredEntries.length,
        year: selectedYear,
      }),
    [
      bestScore,
      topChances,
      strategy,
      scoredEntries.length,
      remainingLeaveDays,
      selectedYear,
      isFutureYear,
    ],
  );

  /*
   * 추천 결과가 확정될 때 익명 통계를 남긴다.
   * 연차를 타이핑하는 동안 매 글자마다 기록되지 않도록 1.2초 디바운스한다.
   * 전송 실패는 무시되며 휴가 계산에는 어떤 영향도 주지 않는다.
   */
  useEffect(() => {
    if (!hasCalculated || needsLeaveInput || remainingLeaveDays <= 0) return;
    const timer = window.setTimeout(() => {
      track("simulation_complete", {
        targetYear: selectedYear,
        leaveDays: remainingLeaveDays,
        vacationStyle: strategy,
        resultDays: result.summary.totalRestDays,
      });
      track("result_view", { targetYear: selectedYear });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [
    hasCalculated,
    needsLeaveInput,
    selectedYear,
    remainingLeaveDays,
    strategy,
    result.summary.totalRestDays,
  ]);

  if (!hasCalculated) return <StartPanel />;

  const handleSelect = (range: VacationOverlayRange) => {
    setSelectedId(range.candidateId);
    setStartMonth(startOfMonth(range.startDate));
  };

  /** TOP3 카드나 레이더에서 고른 날짜로 달력을 이동시킨다. */
  const focusDate = (date: LocalDate) => {
    setStartMonth(startOfMonth(date));
    document.getElementById("vacation-calendar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openChance = (chance: VacationChance) => {
    const matching = ranges.find((range) => range.candidateId === chance.candidate.id);
    if (matching) setSelectedId(matching.candidateId);
    focusDate(chance.candidate.startDate);
  };

  const chanceSaved = (chance: VacationChance) =>
    savedRanges.some((range) => range.candidateId === chance.candidate.id);

  /** TOP3 카드의 찜하기. 오버레이 형식에 맞춰 최소 정보를 담는다. */
  const toggleChanceSave = (chance: VacationChance) => {
    const existing = ranges.find((range) => range.candidateId === chance.candidate.id);
    if (existing) {
      toggleSavedRange(existing);
      return;
    }
    const { label, emoji } = describeCandidate(chance.candidate);
    toggleSavedRange({
      candidateId: chance.candidate.id,
      startDate: chance.candidate.startDate,
      endDate: chance.candidate.endDate,
      leaveDates: chance.candidate.leaveDates,
      partialLeaveDates: [],
      weekendDates: chance.candidate.weekendDates,
      publicHolidayDates: chance.candidate.publicHolidayDates,
      substituteHolidayDates: chance.candidate.substituteHolidayDates,
      companyHolidayDates: chance.candidate.companyHolidayDates,
      totalRestDays: chance.restDays,
      totalRestMinutes: chance.candidate.totalRestMinutes,
      leaveUsedMinutes: chance.candidate.totalLeaveMinutesUsed,
      leaveUsedDays: chance.leaveDays,
      specialLeaveUsedDays: 0,
      efficiency: chance.candidate.efficiencyScore,
      label,
      emoji,
      headline: `연차 ${chance.leaveDays}일 → ${chance.restDays}일 휴식`,
      description: `${chance.dateRange} · 휴가 효율 ${chance.score.score}점`,
    });
  };

  const openMonth = (month: MonthRadar) => {
    if (!month.best) return;
    const matching = ranges.find((range) => range.candidateId === month.best?.id);
    if (matching) setSelectedId(matching.candidateId);
    focusDate(month.best.startDate);
  };


  const manualLeaveCount = manualLeaveDates.length;
  const budgetExceeded = availableLeaveDays === 0 && manualLeaveCount > 0;

  return (
    <div className={styles.page}>
      <YearBar onToggleWallet={() => setWalletOpen((open) => !open)} />
      {walletOpen && <LeaveWalletPanel />}

      {needsLeaveInput ? (
        <FutureYearSetup />
      ) : (
        <>
          <div className={styles.greeting}>
            <div>
              <p className={styles.hello}>안녕하세요 👋</p>
              <h1 className={styles.title}>
                {isFutureYear
                  ? `${selectedYear}년, 미리 잘 쉬어볼까요?`
                  : "올해도 잘 쉬어볼까요?"}
              </h1>
            </div>

            <label className={styles.leaveBox}>
              <span className={styles.leaveLabel}>
                {isFutureYear ? (
                  <>
                    {selectedYear}년 <strong>예상 연차</strong>
                  </>
                ) : (
                  <>
                    전체 휴가 <strong>{totalLeave}일</strong> 중
                  </>
                )}
              </span>
              <input
                className={styles.leaveInput}
                type="number"
                min={0}
                max={90}
                step={0.5}
                value={remainingLeaveDays}
                onChange={(event) => setRemainingLeaveDays(Number(event.target.value))}
                aria-label={`${selectedYear}년 ${leaveEntryType === "expected" ? "예상" : "남은"} 연차 일수`}
              />
              <span className={styles.leaveUnit}>{isFutureYear ? "일" : "일 남음"}</span>
            </label>
          </div>

          <p className={styles.expiryNote}>
            🗓️{" "}
            {isFutureYear ? (
              <>
                <strong>{selectedYear}년 전체</strong> 공휴일로 미리 계산했어요. 예상 연차는 언제든
                바꿀 수 있어요.
              </>
            ) : (
              <>
                <strong>{describeLeaveExpiry(companyPolicy, today)}</strong>까지 쓸 수 있는 연차
                기준으로 계산했어요.
                <button
                  type="button"
                  className={styles.inlineLink}
                  onClick={() => navigate("/company")}
                >
                  소멸일 변경
                </button>
              </>
            )}
          </p>

      <StrategyTabs
            value={strategy}
            onChange={(next) => {
              setStrategy(next);
              track("vacation_style_select", {
                targetYear: selectedYear,
                vacationStyle: next,
              });
            }}
          />

      {result.summary.holidayDataStatus !== HolidayDataStatus.Official && (
        <p className={styles.notice}>
          일부 기간은 공휴일 일정이 확정되지 않았어요. 확정 후 추천이 바뀔 수 있어요.
        </p>
      )}

      <MascotMessage text={mascotText} />

      <TopChances
        chances={topChances}
        year={selectedYear}
        currentYear={currentYear}
        onOpen={openChance}
        onToggleSave={toggleChanceSave}
        isSaved={chanceSaved}
      />

      <VacationRadar
        radar={radar}
        year={radarYear}
        selectedMonth={selected ? toCivil(selected.startDate).month : undefined}
        onSelectMonth={openMonth}
      />

      <div className={styles.layout} id="vacation-calendar">
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
            yearViewLabel={`${selectedYear}년 전체보기`}
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
                onClick={() => {
                  toggleSavedRange(selected);
                  if (!isRangeSaved(selected.candidateId)) {
                    track("save_combination", {
                      targetYear: selectedYear,
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
                        {formatDateRange(range.startDate, range.endDate)} ·{" "}
                        {/* 리프레시휴가는 연차를 쓰지 않으므로 이름을 그대로 보여준다. */}
                        {range.specialLeaveUsedDays > 0
                          ? `${range.specialLeaveName ?? "특별휴가"} ${range.specialLeaveUsedDays}일`
                          : `연차 ${range.leaveUsedDays}일`}
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

          {selectedYear === currentYear && <NextYearCta />}
        </>
      )}
    </div>
  );
}
