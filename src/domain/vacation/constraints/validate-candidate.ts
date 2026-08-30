import type { VacationCandidate } from "../models/vacation-candidate";
import type { VacationConstraint, VacationContext } from "./constraint";

export interface ConstraintFailure {
  constraintId: string;
  reason: string;
}

export interface ValidationOutcome {
  valid: boolean;
  failures: ConstraintFailure[];
}

export function validateCandidate(
  candidate: VacationCandidate,
  constraints: VacationConstraint[],
  context: VacationContext,
): ValidationOutcome {
  const failures: ConstraintFailure[] = [];

  for (const constraint of constraints) {
    const result = constraint.validate(candidate, context);
    if (!result.valid) {
      failures.push({
        constraintId: constraint.id,
        reason: result.reason ?? "제약 조건 위반",
      });
    }
  }

  return { valid: failures.length === 0, failures };
}

export function filterValidCandidates(
  candidates: VacationCandidate[],
  constraints: VacationConstraint[],
  context: VacationContext,
): VacationCandidate[] {
  return candidates.filter((candidate) => validateCandidate(candidate, constraints, context).valid);
}
