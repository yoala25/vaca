import { roundTo } from "../candidates/build-candidate";
import { compareScored } from "../scoring/score-candidate";
import type { StrategyRules } from "../scoring/scoring-config";
import { findLeaveType, type LeaveType } from "../models/leave-type";
import { differenceInDays, eachDayInRange, monthKey } from "../models/local-date";
import type { VacationCandidate } from "../models/vacation-candidate";
import type { ScoredCandidate, VacationPortfolio, VacationStrategy } from "../models/vacation-plan";

export interface OptimizePortfolioOptions {
  strategy: VacationStrategy;
  scored: ScoredCandidate[];
  rules: StrategyRules;
  leaveCatalog: LeaveType[];
  annualLeaveRemainingMinutes: number;
  standardDailyWorkMinutes: number;
  /**
   * 반차·시간차 후보를 포트폴리오 본문에 포함할지.
   *
   * 기본값 false. 부분휴가는 "연차 N일 → M일 휴식"이라는 대표 지표와 단위가 맞지 않는다.
   * 예를 들어 목요일 오후반차 + 금요일 연차 + 월요일 오전반차는 실제로는 목 13:00부터
   * 월 13:00까지 꼬박 4일을 쉬지만, 온전한 휴식일만 세면 3일이라 효율 1.5로 표시된다.
   * 숫자가 사용자를 오해시키므로 기본 추천에서는 빼고, 부분휴가는 선택한 휴가를 더 늘리는
   * 부가 제안으로 다루는 편이 정직하다. 후보 자체는 계속 생성·평가되므로 언제든 켤 수 있다.
   */
  includePartialLeave?: boolean;
}

/** 연차 잔여에서 실제로 차감되는 분. */
function deductedMinutes(candidate: VacationCandidate, leaveCatalog: LeaveType[]): number {
  return candidate.leaveUsages.reduce((sum, usage) => {
    const type = findLeaveType(leaveCatalog, usage.leaveTypeId);
    return type?.deductsFromAnnualLeave ? sum + usage.minutes : sum;
  }, 0);
}

function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    [x, y] = [y, x % y];
  }
  return x;
}

/**
 * 예산 축을 정수 격자로 압축한다.
 * 모든 비용과 예산의 최대공약수를 단위로 쓰면 반올림 오차 없이 정확한 DP가 된다.
 */
function chooseBudgetUnit(costs: number[], budget: number): number {
  const unit = costs.reduce((acc, cost) => greatestCommonDivisor(acc, cost), budget);
  if (unit <= 0) return 30;
  // 격자가 지나치게 촘촘해지면 성능을 위해 30분 단위로 되돌린다.
  return budget / unit > 4000 ? 30 : unit;
}

/**
 * 이 전략이 "성격상" 받아들일 수 있는 후보만 남긴다.
 * 전략마다 결과가 실제로 달라지게 만드는 1차 장치다.
 */
function filterEligible(
  scored: ScoredCandidate[],
  rules: StrategyRules,
  standardDailyWorkMinutes: number,
  includePartialLeave: boolean,
): ScoredCandidate[] {
  const eligible = scored.filter(({ candidate }) => {
    if (!includePartialLeave && candidate.partialMetrics) return false;
    if (candidate.consecutiveFullRestDays < rules.minFullRestDays) return false;
    if (rules.maxLeaveDaysPerCandidate !== undefined) {
      const leaveDays = candidate.totalLeaveMinutesUsed / standardDailyWorkMinutes;
      if (leaveDays > rules.maxLeaveDaysPerCandidate + 1e-9) return false;
    }
    return true;
  });
  // 조건이 너무 빡세서 아무것도 없으면 원본을 그대로 쓴다(빈 결과 방지).
  return eligible.length > 0 ? eligible : scored;
}

/**
 * 후보 j 다음에 후보 i를 고를 수 있는가?
 * 날짜가 겹치지 않아야 하고, 전략이 요구하는 최소 간격도 지켜야 한다.
 */
function isCompatible(
  earlier: VacationCandidate,
  later: VacationCandidate,
  minGapDays: number,
): boolean {
  return differenceInDays(earlier.endDate, later.startDate) > minGapDays;
}

/**
 * 예산·중복·개수 제약을 모두 지키면서 총점을 최대화하는 조합을 찾는다.
 *
 * "효율 높은 순으로 담기" 같은 greedy는 전체 최적을 놓친다(§26). 여기서는
 * weighted interval scheduling과 knapsack을 결합한 정확한 DP를 쓴다.
 *
 *   dp[i][b][k] = 앞에서부터 i개 후보까지 고려하고, 예산 b칸을 쓰고, k개를 고른 최대 점수
 *   dp[i][b][k] = max( dp[i-1][b][k],                              // i번째를 건너뛴다
 *                      dp[p(i)][b - cost_i][k-1] + score_i )       // i번째를 고른다
 *
 * p(i)는 i와 양립 가능한 마지막 후보의 인덱스로, 종료일 기준 정렬 + 이분탐색으로 구한다.
 */
export function optimizePortfolio(options: OptimizePortfolioOptions): VacationPortfolio {
  const {
    strategy,
    rules,
    leaveCatalog,
    annualLeaveRemainingMinutes,
    standardDailyWorkMinutes,
  } = options;

  const eligible = filterEligible(
    options.scored,
    rules,
    standardDailyWorkMinutes,
    options.includePartialLeave ?? false,
  );

  const maxPick = Math.max(1, rules.maxSelectedCandidates);

  /*
   * 특별휴가(리프레시·안식휴가)는 연차와 다른 주머니에서 나온다.
   * 같은 선택 자리를 놓고 경쟁시키면, 연차 조합이 점수에서 이겨
   * 별도로 부여받은 휴가가 영영 추천되지 않는다.
   * 그래서 트랙을 나눠 각각 배치한다.
   */
  const specialItems = eligible.filter((item) => item.candidate.specialLeaveMinutesUsed > 0);

  if (specialItems.length === 0) {
    // 특별휴가가 없으면 예전과 완전히 동일한 경로를 탄다.
    const selected = solveTrack(
      eligible,
      leaveCatalog,
      annualLeaveRemainingMinutes,
      maxPick,
      rules.minGapDaysBetweenCandidates,
    );
    if (selected.length === 0) return emptyPortfolio(strategy, annualLeaveRemainingMinutes);
    return buildPortfolio({
      strategy,
      selected,
      leaveCatalog,
      annualLeaveRemainingMinutes,
      standardDailyWorkMinutes,
    });
  }

  /*
   * ① 특별휴가를 먼저 배치한다.
   *    쓰지 않으면 소멸하는 별도 부여 휴가라 "쓸지 말지"가 아니라
   *    "언제 쓸지"의 문제이기 때문이다.
   *    휴가 종류마다 한 번씩만 고른다(리프레시휴가를 두 번 쓸 수는 없다).
   */
  const specialTypeIds = new Set(
    specialItems.flatMap((item) =>
      item.candidate.leaveUsages
        .filter((usage) => !findLeaveType(leaveCatalog, usage.leaveTypeId)?.deductsFromAnnualLeave)
        .map((usage) => usage.leaveTypeId),
    ),
  );
  const specialSelected = solveTrack(
    specialItems,
    leaveCatalog,
    // 특별휴가는 연차를 쓰지 않으므로 연차 예산과 무관하게 배치한다.
    Math.max(annualLeaveRemainingMinutes, standardDailyWorkMinutes),
    Math.max(1, specialTypeIds.size),
    rules.minGapDaysBetweenCandidates,
  );

  /*
   * ② 남은 연차는 특별휴가 일정을 피해서 배치한다.
   *    같은 날을 두 번 쉴 수는 없으므로 겹치는 후보는 제외한다.
   */
  const annualItems = eligible.filter(
    (item) =>
      item.candidate.specialLeaveMinutesUsed === 0 &&
      !specialSelected.some((picked) => overlaps(picked.candidate, item.candidate)),
  );
  const annualSelected = solveTrack(
    annualItems,
    leaveCatalog,
    annualLeaveRemainingMinutes,
    maxPick,
    rules.minGapDaysBetweenCandidates,
  );

  const merged = [...specialSelected, ...annualSelected];
  if (merged.length === 0) return emptyPortfolio(strategy, annualLeaveRemainingMinutes);

  return buildPortfolio({
    strategy,
    selected: merged,
    leaveCatalog,
    annualLeaveRemainingMinutes,
    standardDailyWorkMinutes,
  });
}

/** 두 휴가 구간이 하루라도 겹치는가. */
function overlaps(a: VacationCandidate, b: VacationCandidate): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

/**
 * 예산·중복·개수 제약을 지키면서 총점을 최대화하는 조합을 DP로 찾는다.
 * 트랙(연차/특별휴가)마다 따로 호출된다.
 */
function solveTrack(
  eligible: ScoredCandidate[],
  leaveCatalog: LeaveType[],
  annualLeaveRemainingMinutes: number,
  maxPick: number,
  minGapDays: number,
): ScoredCandidate[] {
  // DP는 종료일 오름차순 정렬을 전제로 한다.
  const items = [...eligible].sort((a, b) => {
    const byEnd = a.candidate.endDate.localeCompare(b.candidate.endDate);
    return byEnd !== 0 ? byEnd : compareScored(a, b);
  });

  const costs = items.map((item) => deductedMinutes(item.candidate, leaveCatalog));
  const unit = chooseBudgetUnit(costs, annualLeaveRemainingMinutes);
  const budgetCells = Math.floor(annualLeaveRemainingMinutes / unit);
  const costCells = costs.map((cost) => Math.ceil(cost / unit));

  const n = items.length;
  if (n === 0 || budgetCells <= 0) return [];

  // p[i] (1-based): i번째 후보와 양립 가능한 마지막 후보 개수
  const compatibleUpTo = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    compatibleUpTo[i] = findLastCompatible(items, i - 1, minGapDays);
  }

  const budgetSpan = budgetCells + 1;
  const pickSpan = maxPick + 1;
  const planeSize = budgetSpan * pickSpan;
  const dp = new Float64Array((n + 1) * planeSize);
  const at = (i: number, b: number, k: number) => i * planeSize + b * pickSpan + k;

  for (let i = 1; i <= n; i++) {
    const cost = costCells[i - 1];
    const score = items[i - 1].score;
    const previous = compatibleUpTo[i];

    for (let b = 0; b <= budgetCells; b++) {
      for (let k = 0; k <= maxPick; k++) {
        let best = dp[at(i - 1, b, k)];
        if (k >= 1 && b >= cost) {
          const withCandidate = dp[at(previous, b - cost, k - 1)] + score;
          if (withCandidate > best) best = withCandidate;
        }
        dp[at(i, b, k)] = best;
      }
    }
  }

  return backtrack({ dp, at, items, costCells, compatibleUpTo, budgetCells, maxPick });
}

/** 종료일 오름차순 배열에서 후보 i와 양립 가능한 마지막 후보의 개수를 이분탐색한다. */
function findLastCompatible(
  items: ScoredCandidate[],
  targetIndex: number,
  minGapDays: number,
): number {
  const target = items[targetIndex].candidate;
  let low = 0;
  let high = targetIndex - 1;
  let answer = 0;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (isCompatible(items[mid].candidate, target, minGapDays)) {
      answer = mid + 1; // 1-based 개수
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return answer;
}

interface BacktrackParams {
  dp: Float64Array;
  at: (i: number, b: number, k: number) => number;
  items: ScoredCandidate[];
  costCells: number[];
  compatibleUpTo: number[];
  budgetCells: number;
  maxPick: number;
}

function backtrack(params: BacktrackParams): ScoredCandidate[] {
  const { dp, at, items, costCells, compatibleUpTo, budgetCells, maxPick } = params;
  const n = items.length;

  // 최적 (예산, 개수) 조합을 먼저 찾는다.
  let bestScore = -Infinity;
  let bestBudget = 0;
  let bestPick = 0;
  for (let b = 0; b <= budgetCells; b++) {
    for (let k = 0; k <= maxPick; k++) {
      const value = dp[at(n, b, k)];
      if (value > bestScore + 1e-9) {
        bestScore = value;
        bestBudget = b;
        bestPick = k;
      }
    }
  }

  const chosen: ScoredCandidate[] = [];
  let i = n;
  let b = bestBudget;
  let k = bestPick;

  while (i > 0 && k > 0) {
    if (Math.abs(dp[at(i, b, k)] - dp[at(i - 1, b, k)]) < 1e-9) {
      i -= 1;
      continue;
    }
    const cost = costCells[i - 1];
    chosen.push(items[i - 1]);
    b -= cost;
    k -= 1;
    i = compatibleUpTo[i];
  }

  return chosen.reverse();
}

interface BuildPortfolioParams {
  strategy: VacationStrategy;
  selected: ScoredCandidate[];
  leaveCatalog: LeaveType[];
  annualLeaveRemainingMinutes: number;
  standardDailyWorkMinutes: number;
}

function buildPortfolio(params: BuildPortfolioParams): VacationPortfolio {
  const { strategy, selected, leaveCatalog, annualLeaveRemainingMinutes } = params;
  const candidates = selected
    .map((item) => item.candidate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  // 겹치는 날을 두 번 세지 않는다 (§25).
  const distinctRestDays = new Set<string>();
  for (const candidate of candidates) {
    for (const date of eachDayInRange(candidate.startDate, candidate.endDate)) {
      distinctRestDays.add(date);
    }
  }

  const totalAnnualLeaveMinutesUsed = candidates.reduce(
    (sum, candidate) => sum + deductedMinutes(candidate, leaveCatalog),
    0,
  );
  const totalRestMinutes = candidates.reduce(
    (sum, candidate) => sum + candidate.totalRestMinutes,
    0,
  );
  const leaveDaysUsed = totalAnnualLeaveMinutesUsed / params.standardDailyWorkMinutes;

  return {
    strategy,
    selectedCandidates: candidates,
    totalAnnualLeaveMinutesUsed,
    totalRestMinutes,
    totalDistinctRestDays: distinctRestDays.size,
    portfolioEfficiency: leaveDaysUsed > 0 ? roundTo(distinctRestDays.size / leaveDaysUsed, 2) : 0,
    remainingLeaveMinutes: annualLeaveRemainingMinutes - totalAnnualLeaveMinutesUsed,
    score: roundTo(
      selected.reduce((sum, item) => sum + item.score, 0) + calculateDistributionBonus(candidates),
      3,
    ),
  };
}

function emptyPortfolio(
  strategy: VacationStrategy,
  annualLeaveRemainingMinutes: number,
): VacationPortfolio {
  return {
    strategy,
    selectedCandidates: [],
    totalAnnualLeaveMinutesUsed: 0,
    totalRestMinutes: 0,
    totalDistinctRestDays: 0,
    portfolioEfficiency: 0,
    remainingLeaveMinutes: annualLeaveRemainingMinutes,
    score: 0,
  };
}

/** 서로 다른 달에 흩어질수록 가점 (§27). 보고용 지표이며 선택 자체는 DP가 결정한다. */
export function calculateDistributionBonus(candidates: VacationCandidate[]): number {
  if (candidates.length <= 1) return 0;
  const months = new Set(candidates.map((candidate) => monthKey(candidate.startDate)));
  return months.size / candidates.length;
}
