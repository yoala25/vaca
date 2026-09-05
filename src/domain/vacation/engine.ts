import { buildCalendar, indexHolidays } from "./calendar/build-calendar";
import { createCalendarIndex, type CalendarIndex } from "./calendar/calendar-index";
import { generateCandidates } from "./candidates/generate-candidates";
import { createDefaultConstraints } from "./constraints/built-in-constraints";
import type { VacationConstraint } from "./constraints/constraint";
import { generateCalendarOverlay } from "./overlays/generate-calendar-overlay";
import { optimizePortfolio } from "./optimizer/optimize-portfolio";
import { scoreCandidates } from "./scoring/score-candidate";
import { STRATEGY_RULES } from "./scoring/scoring-config";
import { ANNUAL_LEAVE_TYPE_ID, findLeaveType } from "./models/leave-type";
import type { LocalDate } from "./models/local-date";
import type { VacationCandidate } from "./models/vacation-candidate";
import type {
  VacationEngineInput,
  VacationOptimizationResult,
} from "./models/vacation-plan";

interface CandidatePool {
  cacheKey: string;
  index: CalendarIndex;
  candidates: VacationCandidate[];
  holidayNamesByDate: Map<LocalDate, string>;
  annualLeaveRemainingMinutes: number;
}

export interface VacationEngineOptions {
  constraints?: VacationConstraint[];
  /** 후보 풀 계산 시간을 재는 등 디버깅에 쓸 훅. */
  onPoolBuilt?: (info: { candidateCount: number; elapsedMs: number }) => void;
}

/**
 * 캐시 무효화 키 (§52).
 * 전략(strategy)은 일부러 제외한다 — 전략만 바뀌면 후보 풀을 그대로 재사용한다.
 */
function buildCacheKey(input: VacationEngineInput): string {
  return JSON.stringify({
    range: input.dateRange,
    schedule: input.workSchedule,
    holidays: input.holidays.holidays,
    companyHolidays: input.companyHolidays,
    leaveCatalog: input.leaveCatalog,
    blockedDates: input.preferences?.blockedDates ?? [],
    includeSpecialLeave: input.includeSpecialLeave ?? false,
  });
}

function annualRemainingMinutes(input: VacationEngineInput): number {
  const annual = findLeaveType(input.leaveCatalog, ANNUAL_LEAVE_TYPE_ID);
  return Math.max(0, annual?.remainingMinutes ?? 0);
}

/**
 * 휴가 최적화 엔진.
 *
 * 파이프라인:
 *   Calendar Builder → Day Normalizer → Candidate Generator → Constraint Validator
 *   → Candidate Evaluator → Strategy Scorer → Portfolio Optimizer
 *   → Calendar Overlay Generator → Explanation Generator
 *
 * 앞 4단계(달력 + 후보 풀)는 전략과 무관하므로 캐시하고,
 * 전략이 바뀌면 점수·포트폴리오·오버레이만 다시 계산한다.
 */
export function createVacationEngine(options: VacationEngineOptions = {}) {
  const constraints = options.constraints ?? createDefaultConstraints();
  let cachedPool: CandidatePool | null = null;

  function getPool(input: VacationEngineInput): CandidatePool {
    const cacheKey = buildCacheKey(input);
    if (cachedPool && cachedPool.cacheKey === cacheKey) return cachedPool;

    const startedAt = Date.now();
    const days = buildCalendar({
      range: input.dateRange,
      workSchedule: input.workSchedule,
      holidays: input.holidays,
      companyHolidays: input.companyHolidays,
      blockedDates: input.preferences?.blockedDates,
    });
    const index = createCalendarIndex(days);
    const remaining = annualRemainingMinutes(input);

    const candidates = generateCandidates({
      index,
      schedule: input.workSchedule,
      leaveCatalog: input.leaveCatalog,
      annualLeaveRemainingMinutes: remaining,
      constraints,
      blockedDates: new Set(input.preferences?.blockedDates ?? []),
      includeSpecialLeave: input.includeSpecialLeave,
    });

    const holidayIndex = indexHolidays(input.holidays.holidays);
    const holidayNamesByDate = new Map<LocalDate, string>();
    for (const [date, resolved] of holidayIndex) holidayNamesByDate.set(date, resolved.name);

    cachedPool = {
      cacheKey,
      index,
      candidates,
      holidayNamesByDate,
      annualLeaveRemainingMinutes: remaining,
    };

    options.onPoolBuilt?.({
      candidateCount: candidates.length,
      elapsedMs: Date.now() - startedAt,
    });

    return cachedPool;
  }

  function optimize(input: VacationEngineInput): VacationOptimizationResult {
    const pool = getPool(input);
    const rules = STRATEGY_RULES[input.strategy];

    const rankedCandidates = scoreCandidates(pool.candidates, {
      strategy: input.strategy,
      preferences: input.preferences,
      rules,
    });

    const portfolio = optimizePortfolio({
      strategy: input.strategy,
      scored: rankedCandidates,
      rules,
      leaveCatalog: input.leaveCatalog,
      annualLeaveRemainingMinutes: pool.annualLeaveRemainingMinutes,
      standardDailyWorkMinutes: pool.index.standardDailyWorkMinutes,
      includePartialLeave: input.includePartialLeaveInPortfolio,
    });

    const calendarOverlay = generateCalendarOverlay({
      leaveCatalog: input.leaveCatalog,
      portfolio,
      holidayNamesByDate: pool.holidayNamesByDate,
      standardDailyWorkMinutes: pool.index.standardDailyWorkMinutes,
    });

    const leaveDaysUsed =
      portfolio.totalAnnualLeaveMinutesUsed / pool.index.standardDailyWorkMinutes;

    return {
      strategy: input.strategy,
      bestCandidate: portfolio.selectedCandidates[0] ?? rankedCandidates[0]?.candidate,
      rankedCandidates,
      portfolio,
      calendarOverlay,
      summary: {
        remainingLeaveMinutes: portfolio.remainingLeaveMinutes,
        leaveMinutesUsed: portfolio.totalAnnualLeaveMinutesUsed,
        leaveDaysUsed: Math.round(leaveDaysUsed * 10) / 10,
        totalRestDays: portfolio.totalDistinctRestDays,
        efficiency: Math.round(portfolio.portfolioEfficiency * 10) / 10,
        holidayDataStatus: input.holidays.dataStatus,
      },
    };
  }

  return {
    optimize,
    /** 테스트/디버깅용: 전략 적용 전의 후보 풀을 그대로 본다. */
    inspectPool: (input: VacationEngineInput) => getPool(input),
    clearCache: () => {
      cachedPool = null;
    },
  };
}

export type VacationEngine = ReturnType<typeof createVacationEngine>;
