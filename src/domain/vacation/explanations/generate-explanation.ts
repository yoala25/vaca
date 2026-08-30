import { DAY_OF_WEEK_KO, dayOfWeek, toCivil, type LocalDate } from "../models/local-date";
import { LeaveSlot } from "../models/leave-type";
import type { VacationCandidate } from "../models/vacation-candidate";
import { VacationStrategy } from "../models/vacation-plan";

/**
 * AI를 쓰지 않고 reasonCode + 계산 결과만으로 자연어 설명을 만든다 (§35).
 * 모든 문장은 결정적 템플릿이므로 같은 입력이면 같은 문장이 나온다.
 */

export function formatMonthDay(date: LocalDate): string {
  const { month, day } = toCivil(date);
  return `${month}/${day}(${DAY_OF_WEEK_KO[dayOfWeek(date)]})`;
}

export function formatDateRange(start: LocalDate, end: LocalDate): string {
  return start === end ? formatMonthDay(start) : `${formatMonthDay(start)} ~ ${formatMonthDay(end)}`;
}

function formatLeaveDays(days: number): string {
  return `${Math.round(days * 10) / 10}일`;
}

/** "연차 2일 → 9일 휴식" 같은 한 줄 요약. */
export function generateHeadline(candidate: VacationCandidate): string {
  const leaveDays = formatLeaveDays(candidate.annualLeaveEquivalentDays);
  return `연차 ${leaveDays} → ${candidate.consecutiveFullRestDays}일 휴식`;
}

/** 왜 이 조합이 좋은지 설명하는 문장. */
export function generateExplanation(candidate: VacationCandidate): string {
  const sentences: string[] = [];
  const codes = new Set(candidate.reasonCodes);

  const connected: string[] = [];
  if (codes.has("CONNECTS_WEEKEND")) connected.push("주말");
  if (codes.has("CONNECTS_PUBLIC_HOLIDAY")) connected.push("공휴일");
  if (codes.has("CONNECTS_SUBSTITUTE_HOLIDAY")) connected.push("대체공휴일");
  if (codes.has("CONNECTS_COMPANY_HOLIDAY")) connected.push("회사 휴무일");

  const leaveDays = formatLeaveDays(candidate.annualLeaveEquivalentDays);

  if (connected.length > 0) {
    sentences.push(
      `${connected.join("과 ")} 사이에 연차 ${leaveDays}만 사용하면 ${candidate.consecutiveFullRestDays}일 연속으로 쉴 수 있어요.`,
    );
  } else {
    sentences.push(`연차 ${leaveDays}로 ${candidate.consecutiveFullRestDays}일 연속 휴식을 만들 수 있어요.`);
  }

  if (codes.has("HIGH_EFFICIENCY")) {
    sentences.push(`연차 1일당 ${candidate.efficiencyScore}일을 쉬는 셈이라 효율이 높은 조합이에요.`);
  }

  const partialSentence = describePartialLeave(candidate);
  if (partialSentence) sentences.push(partialSentence);

  if (codes.has("LONG_CONSECUTIVE_BREAK")) {
    sentences.push("일주일 넘게 이어지는 긴 휴식이라 여행 계획을 세우기 좋아요.");
  }

  return sentences.filter(Boolean).join(" ");
}

function describePartialLeave(candidate: VacationCandidate): string | undefined {
  const partial = candidate.leaveUsages.find((usage) => usage.slot !== LeaveSlot.Full);
  if (!partial || !candidate.partialMetrics) return undefined;

  const extensionHours = Math.round((candidate.partialMetrics.extensionMinutesComparedToNormal / 60) * 10) / 10;
  if (extensionHours <= 0) return undefined;

  const label = describeSlot(partial.slot, partial.minutes);
  const when = formatMonthDay(partial.date);

  if (partial.slot === LeaveSlot.Afternoon || partial.slot === LeaveSlot.DayEnd) {
    return `${when}에 ${label}를 사용하면 휴식을 ${extensionHours}시간 먼저 시작할 수 있어요.`;
  }
  return `${when}에 ${label}를 사용하면 휴식이 ${extensionHours}시간 더 이어져요.`;
}

function describeSlot(slot: string, minutes: number): string {
  switch (slot) {
    case LeaveSlot.Morning:
      return "오전 반차";
    case LeaveSlot.Afternoon:
      return "오후 반차";
    case LeaveSlot.DayStart:
    case LeaveSlot.DayEnd:
      return `${Math.round(minutes / 60)}시간차`;
    default:
      return "휴가";
  }
}

/** 포트폴리오 전체를 한 줄로 요약한다. */
export function generatePortfolioSummary(
  strategy: VacationStrategy,
  candidateCount: number,
  totalRestDays: number,
  leaveDaysUsed: number,
): string {
  const leaveDays = formatLeaveDays(leaveDaysUsed);

  switch (strategy) {
    case VacationStrategy.LongBreak:
      return `연차 ${leaveDays}를 몰아 써서 최대 ${totalRestDays}일을 쉬는 조합이에요.`;
    case VacationStrategy.LeaveSaving:
      return `연차 ${leaveDays}만 쓰고 ${totalRestDays}일을 쉬는, 가장 아껴 쓰는 조합이에요.`;
    case VacationStrategy.FrequentBreaks:
      return `연차 ${leaveDays}를 ${candidateCount}번으로 나눠 총 ${totalRestDays}일을 쉬는 조합이에요.`;
    default:
      return `연차 ${leaveDays}로 총 ${totalRestDays}일을 쉬는 균형 잡힌 조합이에요.`;
  }
}

const SEASON_EMOJI: Record<number, string> = {
  1: "❄️", 2: "🌱", 3: "🌷", 4: "🌸", 5: "🎈", 6: "🌿",
  7: "🏖️", 8: "☀️", 9: "🍁", 10: "🍂", 11: "🧣", 12: "🎄",
};

const HOLIDAY_LABELS: { match: string; label: string; emoji: string }[] = [
  { match: "추석", label: "추석 황금휴가", emoji: "🌕" },
  { match: "설날", label: "설 연휴", emoji: "🧧" },
  { match: "삼일절", label: "봄맞이 휴가", emoji: "🌷" },
  { match: "어린이날", label: "가정의 달 휴가", emoji: "🎈" },
  { match: "부처님오신날", label: "봄 리프레시", emoji: "🌸" },
  { match: "현충일", label: "초여름 휴식", emoji: "🌿" },
  { match: "광복절", label: "늦여름 바캉스", emoji: "⛱️" },
  { match: "개천절", label: "가을 징검다리", emoji: "🍁" },
  { match: "한글날", label: "가을 단풍 휴가", emoji: "🍂" },
  { match: "성탄절", label: "연말 힐링", emoji: "🎄" },
  { match: "신정", label: "새해 시작 휴가", emoji: "🎍" },
];

/** 후보에 붙일 사람이 읽을 이름. 포함된 공휴일에서 유도한다. */
export function generateCandidateLabel(
  candidate: VacationCandidate,
  holidayNamesByDate: Map<LocalDate, string>,
): { label: string; emoji: string } {
  const holidayDates = [
    ...candidate.publicHolidayDates,
    ...candidate.substituteHolidayDates,
  ].sort();

  for (const date of holidayDates) {
    const name = holidayNamesByDate.get(date);
    if (!name) continue;
    const matched = HOLIDAY_LABELS.find((entry) => name.includes(entry.match));
    if (matched) return { label: matched.label, emoji: matched.emoji };
  }

  if (candidate.companyHolidayDates.length > 0) {
    return { label: "회사 휴무 연휴", emoji: "🏢" };
  }

  const month = toCivil(candidate.startDate).month;
  return { label: `${month}월 징검다리 휴가`, emoji: SEASON_EMOJI[month] };
}
