import { useNavigate } from "react-router-dom";
import { OnboardingHeader } from "../../features/onboarding/OnboardingHeader";
import { CalculatingStep } from "../../features/onboarding/steps/CalculatingStep";
import { usePlanner } from "../../state/PlannerContext";

export function CalculatingPage() {
  const navigate = useNavigate();
  const { completeOnboarding } = usePlanner();

  return (
    <div>
      <OnboardingHeader title="휴가요정" right="" showBack={false} />
      <CalculatingStep
        onDone={() => {
          completeOnboarding();
          // 결과 전용 화면 대신 시뮬레이터로 바로 보낸다.
          navigate("/", { replace: true });
        }}
      />
    </div>
  );
}
