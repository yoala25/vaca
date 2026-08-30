import { roundTo } from "../candidates/build-candidate";
import { toCivil } from "../models/local-date";
import type { CandidateScoreBreakdown, VacationCandidate } from "../models/vacation-candidate";
import {
  SeasonPreference,
  VacationStrategy,
  type ScoredCandidate,
  type VacationPreferences,
} from "../models/vacation-plan";
import { NORMALIZATION, STRATEGY_RULES, type StrategyRules } from "./scoring-config";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function seasonOf(month: number): SeasonPreference | undefined {
  if (month >= 3 && month <= 5) return SeasonPreference.Spring;
  if (month >= 6 && month <= 8) return SeasonPreference.Summer;
  if (month >= 9 && month <= 11) return SeasonPreference.Autumn;
  if (month === 12 || month <= 2) return SeasonPreference.YearEnd;
  return undefined;
}

/** 공휴일·대체공휴일·회사휴무를 얼마나 잘 끌어썼는지 (0~1). */
function calculateHolidayConnection(candidate: VacationCandidate): number {
  const connectedRestDays =
    candidate.publicHolidayDates.length +
    candidate.substituteHolidayDates.length +
    candidate.companyHolidayDates.length +
    candidate.weekendDates.length;
  if (candidate.totalCalendarDays === 0) return 0;
  return clamp01(connectedRestDays / candidate.totalCalendarDays);
}

/** 사용자가 고른 시기와 겹치면 가점. hard filter가 아니라 선호 가중치다 (§41). */
function calculatePreferenceMatch(
  candidate: VacationCandidate,
  preferences: VacationPreferences | undefined,
): number {
  const preferred = preferences?.preferredSeasons ?? [];
  if (preferred.length === 0) return 0;
  const season = seasonOf(toCivil(candidate.startDate).month);
  return season && preferred.includes(season) ? 1 : 0;
}

function calculatePartialExtension(candidate: VacationCandidate): number {
  if (!candidate.partialMetrics) return 0;
  return clamp01(
    candidate.partialMetrics.extensionMinutesComparedToNormal /
      NORMALIZATION.maxPartialExtensionMinutes,
  );
}

export interface ScoreCandidateOptions {
  strategy: VacationStrategy;
  preferences?: VacationPreferences;
  rules?: StrategyRules;
}

/**
 * 후보 하나를 전략 관점에서 점수화한다.
 * 왜 이 점수가 나왔는지 추적할 수 있도록 항상 breakdown을 함께 돌려준다 (§49).
 */
export function scoreCandidate(
  candidate: VacationCandidate,
  options: ScoreCandidateOptions,
): ScoredCandidate {
  const rules = options.rules ?? STRATEGY_RULES[options.strategy];
  const { weights } = rules;

  const durationRatio = clamp01(
    candidate.consecutiveFullRestDays / NORMALIZATION.maxRestDaysForScore,
  );
  const efficiencyRatio = clamp01(
    candidate.efficiencyScore / NORMALIZATION.maxEfficiencyForScore,
  );
  const leaveCostRatio = clamp01(
    candidate.annualLeaveEquivalentDays / NORMALIZATION.maxLeaveDaysForScore,
  );

  const durationScore = weights.duration * durationRatio;
  const efficiencyScore = weights.efficiency * efficiencyRatio;
  const leaveCostScore = weights.leaveCost * leaveCostRatio;
  const holidayConnectionBonus = weights.holidayConnection * calculateHolidayConnection(candidate);
  const preferenceScore =
    weights.preference * calculatePreferenceMatch(candidate, options.preferences);
  const partialScore = weights.partialExtension * calculatePartialExtension(candidate);

  const penalties: { reason: string; value: number }[] = [];

  if (candidate.consecutiveFullRestDays < rules.minFullRestDays) {
    penalties.push({
      reason: `연속 휴식 ${rules.minFullRestDays}일 미만`,
      value: -weights.duration,
    });
  }

  if (
    rules.maxLeaveDaysPerCandidate !== undefined &&
    candidate.annualLeaveEquivalentDays > rules.maxLeaveDaysPerCandidate
  ) {
    penalties.push({
      reason: `이 전략의 후보당 연차 상한(${rules.maxLeaveDaysPerCandidate}일) 초과`,
      value: -Math.abs(weights.efficiency),
    });
  }

  const penaltyTotal = penalties.reduce((sum, penalty) => sum + penalty.value, 0);

  const finalScore =
    durationScore +
    efficiencyScore +
    leaveCostScore +
    holidayConnectionBonus +
    preferenceScore +
    partialScore +
    penaltyTotal;

  const breakdown: CandidateScoreBreakdown = {
    baseScore: durationScore + efficiencyScore,
    durationScore: roundTo(durationScore, 3),
    efficiencyScore: roundTo(efficiencyScore, 3),
    // spacing은 후보 단독으로 정할 수 없고 포트폴리오 단계에서 결정된다.
    spacingScore: 0,
    preferenceScore: roundTo(preferenceScore, 3),
    holidayConnectionBonus: roundTo(holidayConnectionBonus, 3),
    penalties,
    finalScore: roundTo(finalScore, 3),
  };

  return { candidate, score: breakdown.finalScore, breakdown };
}

/** 동점이어도 항상 같은 순서가 나오도록 하는 결정적 정렬 (§44). */
export function compareScored(a: ScoredCandidate, b: ScoredCandidate): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.candidate.totalLeaveMinutesUsed !== b.candidate.totalLeaveMinutesUsed) {
    return a.candidate.totalLeaveMinutesUsed - b.candidate.totalLeaveMinutesUsed;
  }
  if (b.candidate.totalRestMinutes !== a.candidate.totalRestMinutes) {
    return b.candidate.totalRestMinutes - a.candidate.totalRestMinutes;
  }
  if (a.candidate.startDate !== b.candidate.startDate) {
    return a.candidate.startDate.localeCompare(b.candidate.startDate);
  }
  return a.candidate.id.localeCompare(b.candidate.id);
}

export function scoreCandidates(
  candidates: VacationCandidate[],
  options: ScoreCandidateOptions,
): ScoredCandidate[] {
  return candidates.map((candidate) => scoreCandidate(candidate, options)).sort(compareScored);
}
