import { useNavigate, useParams } from "react-router-dom";
import styles from "./OnboardingStepPage.module.css";
import { OnboardingHeader } from "../../features/onboarding/OnboardingHeader";
import { LeaveStep } from "../../features/onboarding/steps/LeaveStep";
import { ScheduleStep } from "../../features/onboarding/steps/ScheduleStep";
import { usePlanner } from "../../state/PlannerContext";

/** MVP 입력은 두 가지뿐이다: 남은 연차 + 근무 요일. 나머지는 홈 시뮬레이터에서 조절한다. */
const STEP_ORDER = ["leave", "schedule"] as const;
type StepId = (typeof STEP_ORDER)[number];

export function OnboardingStepPage() {
  const { step } = useParams<{ step: string }>();
  const navigate = useNavigate();
  const planner = usePlanner();

  const stepId = (STEP_ORDER as readonly string[]).includes(step ?? "")
    ? (step as StepId)
    : "leave";
  const index = STEP_ORDER.indexOf(stepId);

  const goNext = () => {
    const next = STEP_ORDER[index + 1];
    navigate(next ? `/onboarding/${next}` : "/onboarding/calculating");
  };

  const goBack = () => {
    const previous = STEP_ORDER[index - 1];
    navigate(previous ? `/onboarding/${previous}` : "/welcome");
  };

  return (
    <div>
      <OnboardingHeader
        title="휴가요정"
        right={`${index + 1}/${STEP_ORDER.length}`}
        onBack={goBack}
      />
      <div className={styles.body}>
        {stepId === "leave" && (
          <LeaveStep
            answered={planner.remainingLeaveDays}
            onSelect={(value) => {
              planner.setRemainingLeaveDays(value);
              setTimeout(goNext, 700);
            }}
          />
        )}
        {stepId === "schedule" && (
          <ScheduleStep
            value={planner.workPattern}
            onSelect={planner.setWorkPattern}
            onNext={goNext}
          />
        )}
      </div>
    </div>
  );
}
