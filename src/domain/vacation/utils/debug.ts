import { DAY_OF_WEEK_KO, dayOfWeek, eachDayInRange } from "../models/local-date";
import { LeaveSlot } from "../models/leave-type";
import type { CalendarIndex } from "../calendar/calendar-index";
import type { VacationCandidate } from "../models/vacation-candidate";
import type { ScoredCandidate, VacationPortfolio } from "../models/vacation-plan";

/**
 * 개발 중 후보를 눈으로 확인하기 위한 유틸.
 * 문자열만 만들고 스스로 출력하지 않는다 — production 콘솔을 오염시키지 않기 위함 (§48).
 */
export function debugCandidate(
  candidate: VacationCandidate,
  index?: CalendarIndex,
): string {
  const lines: string[] = [];
  lines.push(`${candidate.startDate} ~ ${candidate.endDate}`);
  lines.push("");
  lines.push(`Rest: ${candidate.consecutiveFullRestDays} days (${candidate.totalRestMinutes} min)`);
  lines.push(`Leave: ${candidate.annualLeaveEquivalentDays} days (${candidate.totalLeaveMinutesUsed} min)`);
  lines.push(`Efficiency: ${candidate.efficiencyScore}`);
  lines.push(`Rest interval: ${candidate.restStartDateTime} → ${candidate.restEndDateTime}`);
  lines.push("");

  lines.push("Leave usages:");
  for (const usage of candidate.leaveUsages) {
    const slot = usage.slot === LeaveSlot.Full ? "full-day" : `${usage.slot} ${usage.minutes}min`;
    lines.push(`  ${usage.date} ${slot} (${usage.leaveTypeId})`);
  }

  if (index) {
    lines.push("");
    lines.push("Natural rest:");
    for (const date of eachDayInRange(candidate.startDate, candidate.endDate)) {
      const day = index.dayAt(index.indexOf(date));
      if (!day || day.scheduledWorkMinutes > 0) continue;
      const reason = day.isPublicHoliday
        ? (day.publicHolidayName ?? "holiday")
        : day.isCompanyHoliday
          ? (day.companyHolidayName ?? "company")
          : "weekend";
      lines.push(`  ${date}(${DAY_OF_WEEK_KO[dayOfWeek(date)]}) ${reason}`);
    }
  }

  lines.push("");
  lines.push(`Reasons: ${candidate.reasonCodes.join(", ")}`);

  return lines.join("\n");
}

export function debugScored(scored: ScoredCandidate): string {
  const { breakdown } = scored;
  return [
    debugCandidate(scored.candidate),
    "",
    "Score breakdown:",
    `  duration   ${breakdown.durationScore}`,
    `  efficiency ${breakdown.efficiencyScore}`,
    `  holiday    ${breakdown.holidayConnectionBonus}`,
    `  preference ${breakdown.preferenceScore}`,
    ...breakdown.penalties.map((penalty) => `  penalty    ${penalty.value} (${penalty.reason})`),
    `  FINAL      ${breakdown.finalScore}`,
  ].join("\n");
}

export function debugPortfolio(portfolio: VacationPortfolio): string {
  const lines: string[] = [];
  lines.push(`Strategy: ${portfolio.strategy}`);
  lines.push(
    `Selected ${portfolio.selectedCandidates.length} block(s), ` +
      `${portfolio.totalDistinctRestDays} rest days, ` +
      `${portfolio.totalAnnualLeaveMinutesUsed} leave minutes, ` +
      `efficiency ${portfolio.portfolioEfficiency}`,
  );
  for (const candidate of portfolio.selectedCandidates) {
    lines.push(
      `  ${candidate.startDate}~${candidate.endDate}  ` +
        `rest ${candidate.consecutiveFullRestDays}d  ` +
        `leave ${candidate.annualLeaveEquivalentDays}d  ` +
        `eff ${candidate.efficiencyScore}`,
    );
  }
  return lines.join("\n");
}
