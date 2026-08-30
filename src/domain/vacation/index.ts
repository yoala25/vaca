export * from "./models";
export { buildCalendar, indexHolidays, expandCompanyHolidays } from "./calendar/build-calendar";
export { createCalendarIndex, type CalendarIndex, type RestRun } from "./calendar/calendar-index";
export { generateCandidates } from "./candidates/generate-candidates";
export { enumerateCandidateCores, type CandidateCore } from "./candidates/enumerate-cores";
export {
  removeDominatedCandidates,
  clusterSimilarCandidates,
} from "./candidates/dedupe-candidates";
export * from "./constraints/constraint";
export * from "./constraints/built-in-constraints";
export { validateCandidate, filterValidCandidates } from "./constraints/validate-candidate";
export { scoreCandidate, scoreCandidates, compareScored } from "./scoring/score-candidate";
export { STRATEGY_RULES, NORMALIZATION, type StrategyRules } from "./scoring/scoring-config";
export { optimizePortfolio } from "./optimizer/optimize-portfolio";
export { generateCalendarOverlay } from "./overlays/generate-calendar-overlay";
export {
  generateExplanation,
  generateHeadline,
  generateCandidateLabel,
  generatePortfolioSummary,
  formatDateRange,
  formatMonthDay,
} from "./explanations/generate-explanation";
export { createVacationEngine, type VacationEngine } from "./engine";
export { debugCandidate, debugPortfolio, debugScored } from "./utils/debug";
