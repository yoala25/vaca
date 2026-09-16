import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Home.module.css";
import { StartPanel } from "./StartPanel";
import { usePlanner } from "../../state/PlannerContext";
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
import { HolidayDataStatus, type LocalDate } from "../../domain/vacation";

/**
 * 휴가 설계 첫 화면.
 *
 * "올해 어떻게 쉴 수 있는지"를 요약해서 보여 주고,
 * 날짜를 직접 보고 만지는 일은 달력 보기 화면(/calendar)으로 넘긴다.
 * 요약과 달력을 한 화면에 같이 두면 모바일에서 둘 다 제대로 보이지 않는다.
 */
export function Home() {
  const navigate = useNavigate();
  const {
    needsLeavePrompt,
    planReady,
    strategy,
    remainingLeaveDays,
    totalLeaveDays: totalLeave,
    setRemainingLeaveDays,
    result,
    today,
    savedRanges,
    toggleSavedRange,
    companyPolicy,
    selectedYear,
    currentYear,
    isFutureYear,
    leaveEntryType,
    needsLeaveInput,
  } = usePlanner();

  const ranges = result.calendarOverlay.ranges;
  const [walletOpen, setWalletOpen] = useState(false);

  /*
   * TOP3 · 효율점수 · 레이더는 모두 엔진이 이미 만든 후보 풀(rankedCandidates)에서 파생된다.
   * 휴가 계산을 다시 하지 않으므로 기존 추천 결과와 절대 어긋나지 않는다.
   */
  const scoredEntries = useMemo(
    () => scoreAllCandidates(result.rankedCandidates),
    [result.rankedCandidates],
  );
  const topChances = useMemo(() => pickTopChances(scoredEntries), [scoredEntries]);
  const radar = useMemo(
    () => annotateHighlights(buildMonthlyRadar(scoredEntries, selectedYear)),
    [scoredEntries, selectedYear],
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
    if (!planReady || needsLeavePrompt || needsLeaveInput || remainingLeaveDays <= 0) return;
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
    planReady,
    needsLeavePrompt,
    needsLeaveInput,
    selectedYear,
    remainingLeaveDays,
    strategy,
    result.summary.totalRestDays,
  ]);

  const [waitedForPlan, setWaitedForPlan] = useState(false);
  useEffect(() => {
    if (planReady) return;
    const timer = window.setTimeout(() => setWaitedForPlan(true), 2500);
    return () => window.clearTimeout(timer);
  }, [planReady]);

  // 연도를 바꾸면 바뀐 요약이 바로 보이도록 맨 위로 올린다(첫 렌더에는 움직이지 않는다).
  const previousYear = useRef(selectedYear);
  useEffect(() => {
    if (previousYear.current === selectedYear) return;
    previousYear.current = selectedYear;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedYear]);

  /*
   * 로그인 확인·계정 저장본을 기다리는 동안에는 질문도 결과도 그리지 않는다.
   * 네트워크가 느려 오래 걸리면 2.5초 뒤에는 있는 정보로 판단한다.
   */
  if (!planReady && !waitedForPlan) return <div className={styles.planLoading} aria-busy="true" />;
  if (needsLeavePrompt) return <StartPanel />;

  /** 달력 보기로 넘어간다. 날짜를 주면 그 달이 먼저 보이게 한다. */
  const openCalendar = (focusDate?: LocalDate) => {
    navigate("/calendar", focusDate ? { state: { focusDate } } : undefined);
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
    if (month.best) openCalendar(month.best.startDate);
  };

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
                {isFutureYear ? `${selectedYear}년, 미리 잘 쉬어볼까요?` : "올해도 잘 쉬어볼까요?"}
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
            onOpen={(chance) => openCalendar(chance.candidate.startDate)}
            onToggleSave={toggleChanceSave}
            isSaved={chanceSaved}
          />

          <VacationRadar radar={radar} year={selectedYear} onSelectMonth={openMonth} />

          {/* 날짜를 직접 보고 만지는 일은 여기서 달력 보기로 넘긴다 */}
          <button type="button" className={styles.calendarCta} onClick={() => openCalendar()}>
            <span className={styles.calendarCtaIcon} aria-hidden>
              📅
            </span>
            <span className={styles.calendarCtaBody}>
              <span className={styles.calendarCtaTitle}>달력 보기</span>
              <span className={styles.calendarCtaDesc}>
                {selectedYear}년 달력에서 휴가 배치를 확인하고 직접 바꿔 보세요
              </span>
            </span>
            <span className={styles.calendarCtaArrow} aria-hidden>
              ›
            </span>
          </button>

          {selectedYear === currentYear && <NextYearCta />}
        </>
      )}
    </div>
  );
}
