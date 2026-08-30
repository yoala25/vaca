import { useNavigate } from "react-router-dom";
import { OnboardingHeader } from "../../features/onboarding/OnboardingHeader";
import { CompanyPolicyForm } from "../../features/company/CompanyPolicyForm";
import { usePlanner } from "../../state/PlannerContext";
import styles from "./OnboardingStepPage.module.css";

export function OnboardingCompanySettingsPage() {
  const navigate = useNavigate();
  const { completeOnboarding } = usePlanner();

  const save = () => {
    completeOnboarding();
    navigate("/");
  };

  return (
    <div>
      <OnboardingHeader
        title="회사 휴가제도 설정"
        onBack={() => navigate("/onboarding/company-notice")}
        right={
          <button
            type="button"
            onClick={save}
            style={{ background: "none", border: "none", color: "var(--color-teal-dark)", fontWeight: 700 }}
          >
            저장
          </button>
        }
      />
      <div className={styles.body} style={{ maxWidth: 560 }}>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>
          해당하는 제도만 추가해주세요. 나중에 언제든지 변경할 수 있어요.
        </p>
        <CompanyPolicyForm />
      </div>
    </div>
  );
}
