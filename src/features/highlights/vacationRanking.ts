import {
  generateCandidateLabel,
  formatDateRange,
  hasCandidateOverlap,
  toCivil,
  type LocalDate,
  type ScoredCandidate,
  type VacationCandidate,
} from "../../domain/vacation";
import { KR_HOLIDAYS } from "../../data/holidays";
import { calculateVacationScore, type VacationScore } from "./vacationScore";

/**
 * 엔진이 이미 만들어 둔 후보 풀(result.rankedCandidates)을 다른 관점으로 다시 줄 세운다.
 * 휴가 계산을 새로 하지 않는다 — 정렬 기준만 바꾼다.
 */

const HOLIDAY_NAMES = new Map<LocalDate, string>(
  Object.entries(KR_HOLIDAYS) as [LocalDate, string][],
);

export type ChanceCategory = "efficiency" | "longest" | "thrifty";

export interface VacationChance {
  candidate: VacationCandidate;
  category: ChanceCategory;
  medal: string;
  categoryLabel: string;
  categoryHint: string;
  label: string;
  emoji: string;
  dateRange: string;
  leaveDays: number;
  restDays: number;
  score: VacationScore;
  month: number;
}

const CATEGORY_META: Record<
  ChanceCategory,
  { medal: string; label: string; hint: string }
> = {
  efficiency: { medal: "🥇", label: "효율왕", hint: "가장 적은 연차로 가장 길게" },
  longest: { medal: "🥈", label: "장기휴가왕", hint: "가장 오래 이어지는 휴식" },
  thrifty: { medal: "🥉", label: "연차절약왕", hint: "연차를 아끼면서 4일 이상" },
};

/** 연차절약왕이 되려면 최소 이만큼은 쉬어야 한다. */
const THRIFTY_MIN_REST_DAYS = 4;

/**
 * 하이라이트(TOP3·레이더)에 올릴 최소 연속 휴식일.
 *
 * 반차를 붙여 2일 쉬는 조합은 "연차 0.5일 → 2일"이라 레버리지만 4.0으로 튀는데,
 * 사용자가 실제로 얻는 건 이틀뿐이라 황금연휴와 같은 등급으로 보이면 안 된다.
 * 3일 미만은 하이라이트에서 제외한다(달력·추천 목록에는 그대로 남는다).
 */
const HIGHLIGHT_MIN_REST_DAYS = 3;

export function describeCandidate(candidate: VacationCandidate): {
  label: string;
  emoji: string;
} {
  return generateCandidateLabel(candidate, HOLIDAY_NAMES);
}

function toChance(
  candidate: VacationCandidate,
  category: ChanceCategory,
  score: VacationScore,
): VacationChance {
  const meta = CATEGORY_META[category];
  const { label, emoji } = describeCandidate(candidate);
  return {
    candidate,
    category,
    medal: meta.medal,
    categoryLabel: meta.label,
    categoryHint: meta.hint,
    label,
    emoji,
    dateRange: formatDateRange(candidate.startDate, candidate.endDate),
    leaveDays: Math.round(candidate.annualLeaveEquivalentDays * 10) / 10,
    restDays: candidate.consecutiveFullRestDays,
    score,
    month: toCivil(candidate.startDate).month,
  };
}

export interface ScoredEntry {
  candidate: VacationCandidate;
  score: VacationScore;
}

/** 후보 풀 전체에 효율 점수를 매긴다. TOP3와 레이더가 같은 결과를 공유한다. */
export function scoreAllCandidates(ranked: ScoredCandidate[]): ScoredEntry[] {
  return ranked
    .filter((item) => item.candidate.consecutiveFullRestDays >= HIGHLIGHT_MIN_REST_DAYS)
    .map((item) => ({ candidate: item.candidate, score: calculateVacationScore(item.candidate) }))
    .filter((entry) => entry.score.score > 0);
}

/**
 * 올해의 휴가 찬스 TOP 3.
 * 세 자리는 서로 다른 기준으로 뽑되, 같은 기간이 중복 노출되지 않도록 겹치는 후보는 건너뛴다.
 */
export function pickTopChances(entries: ScoredEntry[]): VacationChance[] {
  if (entries.length === 0) return [];

  const chosen: VacationChance[] = [];
  const isTaken = (candidate: VacationCandidate) =>
    chosen.some((item) => hasCandidateOverlap(item.candidate, candidate));

  const take = (
    category: ChanceCategory,
    pool: ScoredEntry[],
    compare: (a: ScoredEntry, b: ScoredEntry) => number,
  ) => {
    const sorted = [...pool].sort(compare);
    const pick = sorted.find((entry) => !isTaken(entry.candidate));
    if (pick) chosen.push(toChance(pick.candidate, category, pick.score));
  };

  // 🥇 효율왕 — 효율 점수가 가장 높은 조합
  take("efficiency", entries, (a, b) => b.score.score - a.score.score || b.score.leverage - a.score.leverage);

  // 🥈 장기휴가왕 — 연속 휴식이 가장 긴 조합
  take(
    "longest",
    entries,
    (a, b) =>
      b.candidate.consecutiveFullRestDays - a.candidate.consecutiveFullRestDays ||
      b.score.score - a.score.score,
  );

  // 🥉 연차절약왕 — 4일 이상 쉬면서 연차를 가장 적게 쓰는 조합
  const thrifty = entries.filter(
    (entry) => entry.candidate.consecutiveFullRestDays >= THRIFTY_MIN_REST_DAYS,
  );
  take(
    "thrifty",
    thrifty.length > 0 ? thrifty : entries,
    (a, b) =>
      a.candidate.annualLeaveEquivalentDays - b.candidate.annualLeaveEquivalentDays ||
      b.candidate.consecutiveFullRestDays - a.candidate.consecutiveFullRestDays,
  );

  return chosen;
}
