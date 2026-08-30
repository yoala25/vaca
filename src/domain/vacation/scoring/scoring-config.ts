import { VacationStrategy } from "../models/vacation-plan";

/**
 * 전략별 가중치. scoring 함수 안에 숫자를 흩뿌리지 않고 여기에서만 조정한다 (§50).
 * 모든 항목은 "정규화된 0~1 지표"에 곱해지므로 서로 크기 비교가 가능하다.
 */
export interface StrategyWeights {
  /** 연속 휴식 길이. */
  duration: number;
  /** 휴가 효율(휴식일 / 사용 연차일). */
  efficiency: number;
  /** 사용한 연차량(많이 쓸수록 감점이므로 보통 음수). */
  leaveCost: number;
  /** 공휴일·주말 연결 보너스. */
  holidayConnection: number;
  /** 선호 시기 일치 보너스. */
  preference: number;
  /** 부분휴가로 경계를 늘린 것에 대한 보너스. */
  partialExtension: number;
}

export interface StrategyRules {
  weights: StrategyWeights;
  /** 이 전략에서 추천으로 인정할 최소 연속 휴식일. */
  minFullRestDays: number;
  /** 포트폴리오에 담을 최대 후보 수. */
  maxSelectedCandidates: number;
  /** 후보 하나가 쓸 수 있는 최대 연차 일수(무제한이면 undefined). */
  maxLeaveDaysPerCandidate?: number;
  /** 선택된 후보 사이의 최소 시작일 간격(일). 수시 휴가 분산용 (§20). */
  minGapDaysBetweenCandidates: number;
}

/** 정규화 기준값. 지표를 0~1로 접을 때 쓰는 상한. */
export const NORMALIZATION = {
  maxRestDaysForScore: 16,
  maxEfficiencyForScore: 6,
  maxLeaveDaysForScore: 10,
  maxPartialExtensionMinutes: 480,
} as const;

export const STRATEGY_RULES: Record<VacationStrategy, StrategyRules> = {
  [VacationStrategy.LongBreak]: {
    weights: {
      duration: 10,
      efficiency: 2,
      leaveCost: -1,
      holidayConnection: 3,
      preference: 2,
      partialExtension: 0.5,
    },
    minFullRestDays: 4,
    maxSelectedCandidates: 2,
    minGapDaysBetweenCandidates: 0,
  },

  [VacationStrategy.LeaveSaving]: {
    weights: {
      duration: 2,
      efficiency: 10,
      leaveCost: -4,
      holidayConnection: 2,
      preference: 1,
      partialExtension: 1,
    },
    // "1시간 써서 2시간 쉬기"가 최상위로 오지 않도록 최소 휴식일을 둔다 (§19).
    minFullRestDays: 3,
    maxSelectedCandidates: 3,
    maxLeaveDaysPerCandidate: 3,
    minGapDaysBetweenCandidates: 0,
  },

  [VacationStrategy.FrequentBreaks]: {
    weights: {
      duration: 3,
      efficiency: 6,
      leaveCost: -3,
      holidayConnection: 2,
      preference: 1,
      partialExtension: 2,
    },
    minFullRestDays: 3,
    maxSelectedCandidates: 6,
    maxLeaveDaysPerCandidate: 2,
    // 한 달에 몰리지 않도록 최소 3주 간격을 둔다.
    minGapDaysBetweenCandidates: 21,
  },

  [VacationStrategy.Balanced]: {
    weights: {
      duration: 6,
      efficiency: 6,
      leaveCost: -2,
      holidayConnection: 2.5,
      preference: 2,
      partialExtension: 1,
    },
    minFullRestDays: 3,
    maxSelectedCandidates: 4,
    minGapDaysBetweenCandidates: 10,
  },
};
