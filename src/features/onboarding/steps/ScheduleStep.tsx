import { MascotBubble } from "../ChatBubble";
import { OptionCard } from "../OptionCard";
import styles from "./ScheduleStep.module.css";
import type { WorkPattern } from "../../../state/PlannerContext";

const WORK_PATTERN_OPTIONS: { id: WorkPattern; icon: string; title: string; description: string }[] =
  [
    { id: "mon-fri", icon: "📅", title: "월~금 근무", description: "토·일 휴무. 가장 일반적인 형태예요." },
    { id: "mon-sat", icon: "🗓️", title: "월~토 근무", description: "일요일만 휴무예요." },
  ];

interface ScheduleStepProps {
  value: WorkPattern;
  onSelect: (value: WorkPattern) => void;
  onNext: () => void;
}

export function ScheduleStep({ value, onSelect, onNext }: ScheduleStepProps) {
  return (
    <div>
      <MascotBubble>휴가요정님은 언제 쉬시나요?</MascotBubble>
      <div style={{ marginTop: 16 }}>
        {WORK_PATTERN_OPTIONS.map((option) => (
          <OptionCard
            key={option.id}
            icon={option.icon}
            title={option.title}
            description={option.description}
            selected={value === option.id}
            onClick={() => onSelect(option.id)}
          />
        ))}
      </div>
      <button type="button" className={styles.nextBtn} onClick={onNext}>
        내 휴가 찾기 ✨
      </button>
    </div>
  );
}
