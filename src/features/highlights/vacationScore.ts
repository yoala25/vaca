import type { VacationCandidate } from "../../domain/vacation";

/**
 * 휴가 효율 점수 (0~100).
 *
 * ── 조정 방법 ───────────────────────────────────────────────
 * 아래 SCORE_WEIGHTS 와 SCORE_RANGES 숫자만 바꾸면 점수 성향이 달라진다.
 * 가중치 합은 항상 100이 되도록 유지할 것.
 *
 * 네 가지 요소를 합산한다.
 *  1) leverage   연차 1일당 확보한 휴식일 (가장 큰 비중)
 *  2) duration   연속 휴식 길이 (짧게 여러 번보다 길게 쉬는 쪽을 높게)
 *  3) freeRatio  구간에서 주말·공휴일이 차지하는 비율 (남의 휴일을 잘 끼워 넣었는가)
 *  4) thrift     연차를 적게 썼는가
 *
 * 각 요소는 SCORE_RANGES의 [min, max] 구간으로 0~1 정규화한 뒤 가중치를 곱한다.
 * 구간을 벗어나면 0 또는 1로 잘린다(clamp).
 */

export const SCORE_WEIGHTS = {
  leverage: 60,
  duration: 22,
  freeRatio: 12,
  thrift: 6,
} as const;

export const SCORE_RANGES = {
  /** 연차 1일당 휴식일. 3.5 이상이면 만점. */
  leverage: [1.0, 3.5],
  /** 연속 휴식일. 8일 이상이면 만점. */
  duration: [3, 8],
  /** 구간 내 주말·공휴일 비율. 0.85 이상이면 만점. */
  freeRatio: [0.4, 0.85],
  /** 사용 연차(일). 적을수록 좋으므로 뒤집어 쓴다. */
  leaveDays: [1, 5],
} as const;

export interface VacationScore {
  /** 0~100 정수 */
  score: number;
  /** 연차 1일당 휴식일 (소수 1자리) */
  leverage: number;
  grade: ScoreGrade;
  /** 각 요소가 몇 점을 냈는지. 튜닝·디버깅용. */
  breakdown: {
    leverage: number;
    duration: number;
    freeRatio: number;
    thrift: number;
  };
}

export interface ScoreGrade {
  label: string;
  flames: number;
  tone: "hot" | "good" | "fair" | "mild" | "weak";
}

function normalize(value: number, [min, max]: readonly [number, number]): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function gradeFor(score: number): ScoreGrade {
  if (score >= 90) return { label: "대박 찬스", flames: 3, tone: "hot" };
  if (score >= 80) return { label: "강력 추천", flames: 2, tone: "good" };
  if (score >= 70) return { label: "괜찮은 선택", flames: 1, tone: "fair" };
  if (score >= 60) return { label: "무난해요", flames: 0, tone: "mild" };
  return { label: "다른 날짜도 찾아볼까요?", flames: 0, tone: "weak" };
}

export function calculateVacationScore(candidate: VacationCandidate): VacationScore {
  const leaveDays = candidate.annualLeaveEquivalentDays;
  const restDays = candidate.consecutiveFullRestDays;

  // 연차를 한 톨도 안 쓰는 구간은 "휴가 조합"이 아니므로 점수를 매기지 않는다.
  if (leaveDays <= 0 || restDays <= 0) {
    return {
      score: 0,
      leverage: 0,
      grade: gradeFor(0),
      breakdown: { leverage: 0, duration: 0, freeRatio: 0, thrift: 0 },
    };
  }

  const leverage = restDays / leaveDays;
  const freeDays =
    candidate.weekendDates.length +
    candidate.publicHolidayDates.length +
    candidate.substituteHolidayDates.length +
    candidate.companyHolidayDates.length;
  const freeRatio = restDays > 0 ? freeDays / restDays : 0;

  const breakdown = {
    leverage: normalize(leverage, SCORE_RANGES.leverage) * SCORE_WEIGHTS.leverage,
    duration: normalize(restDays, SCORE_RANGES.duration) * SCORE_WEIGHTS.duration,
    freeRatio: normalize(freeRatio, SCORE_RANGES.freeRatio) * SCORE_WEIGHTS.freeRatio,
    // 연차를 적게 쓸수록 높다: 정규화 결과를 뒤집는다.
    thrift: (1 - normalize(leaveDays, SCORE_RANGES.leaveDays)) * SCORE_WEIGHTS.thrift,
  };

  const total = Math.round(
    breakdown.leverage + breakdown.duration + breakdown.freeRatio + breakdown.thrift,
  );
  const score = Math.max(0, Math.min(100, total));

  return {
    score,
    leverage: Math.round(leverage * 10) / 10,
    grade: gradeFor(score),
    breakdown: {
      leverage: Math.round(breakdown.leverage * 10) / 10,
      duration: Math.round(breakdown.duration * 10) / 10,
      freeRatio: Math.round(breakdown.freeRatio * 10) / 10,
      thrift: Math.round(breakdown.thrift * 10) / 10,
    },
  };
}
