import { toCivil, type VacationCandidate } from "../../domain/vacation";
import type { ScoredEntry } from "./vacationRanking";

/**
 * 올해의 휴가 레이더.
 *
 * 공휴일 "개수"로 매기지 않는다. 그 달에 실제로 만들 수 있는 휴가 조합들의
 * 효율 점수와 연속 휴가 길이를 기준으로 등급을 낸다.
 * TOP3와 동일한 ScoredEntry[] 를 입력으로 받아 계산이 어긋나지 않게 한다.
 */

export interface MonthRadar {
  month: number;
  /** 0~100. 그 달의 종합 기회 점수. */
  score: number;
  /** 0~5. 불꽃 개수. */
  level: number;
  label: string;
  /** 그 달 최고 조합 */
  best?: VacationCandidate;
  bestScore: number;
  bestRestDays: number;
  chanceCount: number;
  highlight?: string;
}

const LEVEL_LABELS = ["황금휴가 없음", "기회 있음", "보통", "좋음", "매우 좋음", "초대박"];

/**
 * 그 달 최고 조합의 점수가 등급을 지배해야 한다.
 * 개수 비중이 크면 후보가 많은 달이 전부 최고 등급으로 뭉뚱그려져 변별력이 사라진다.
 */
const BEST_WEIGHT = 0.85;
const COUNT_WEIGHT = 0.15;
const COUNT_SATURATION = 3;

function levelFor(score: number): number {
  if (score >= 85) return 5;
  if (score >= 75) return 4;
  if (score >= 65) return 3;
  if (score >= 50) return 2;
  if (score > 0) return 1;
  return 0;
}

export function buildMonthlyRadar(entries: ScoredEntry[], year: number): MonthRadar[] {
  const byMonth = new Map<number, ScoredEntry[]>();

  for (const entry of entries) {
    const civil = toCivil(entry.candidate.startDate);
    if (civil.year !== year) continue;
    const list = byMonth.get(civil.month) ?? [];
    list.push(entry);
    byMonth.set(civil.month, list);
  }

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const list = byMonth.get(month) ?? [];

    if (list.length === 0) {
      return {
        month,
        score: 0,
        level: 0,
        label: LEVEL_LABELS[0],
        bestScore: 0,
        bestRestDays: 0,
        chanceCount: 0,
      } satisfies MonthRadar;
    }

    const best = list.reduce((top, item) => (item.score.score > top.score.score ? item : top));
    const countRatio = Math.min(1, list.length / COUNT_SATURATION);
    const score = Math.round(best.score.score * BEST_WEIGHT + countRatio * 100 * COUNT_WEIGHT);
    const level = levelFor(score);

    return {
      month,
      score,
      level,
      label: LEVEL_LABELS[level],
      best: best.candidate,
      bestScore: best.score.score,
      bestRestDays: best.candidate.consecutiveFullRestDays,
      chanceCount: list.length,
    } satisfies MonthRadar;
  });
}

/** 레이더에서 가장 좋은 달 한두 개에 한 줄 설명을 붙인다. */
export function annotateHighlights(radar: MonthRadar[]): MonthRadar[] {
  const ranked = [...radar].filter((m) => m.level > 0).sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const runnerUp = ranked.find(
    (m) => top && m.month !== top.month && m.bestScore >= top.bestScore - 5,
  );

  return radar.map((month) => {
    if (top && month.month === top.month) {
      return { ...month, highlight: "올해 최고의 휴가 찬스!" };
    }
    if (runnerUp && month.month === runnerUp.month) {
      return { ...month, highlight: "연차 효율 최고!" };
    }
    return month;
  });
}
