import styles from "./StrategyTabs.module.css";
import { VacationStrategy } from "../../domain/vacation";

interface StrategyOption {
  id: VacationStrategy;
  icon: string;
  label: string;
  description: string;
}

/** MVP는 세 가지만 노출한다. 다섯~여섯 개로 늘리면 다시 복잡해진다. */
export const STRATEGY_TABS: StrategyOption[] = [
  {
    id: VacationStrategy.LongBreak,
    icon: "👑",
    label: "장기 집중",
    description: "연차를 몰아 써서 한 번에 가장 길게 쉬는 조합이에요.",
  },
  {
    id: VacationStrategy.FrequentBreaks,
    icon: "🌿",
    label: "수시 휴가",
    description: "짧은 휴식을 여러 달에 고르게 나눠 쉬는 조합이에요.",
  },
  {
    id: VacationStrategy.LeaveSaving,
    icon: "💎",
    label: "연차 절약",
    description: "연차를 가장 적게 쓰고 길게 쉬는 고효율 조합이에요.",
  },
];

interface StrategyTabsProps {
  value: VacationStrategy;
  onChange: (value: VacationStrategy) => void;
}

export function StrategyTabs({ value, onChange }: StrategyTabsProps) {
  const active = STRATEGY_TABS.find((tab) => tab.id === value) ?? STRATEGY_TABS[0];

  return (
    <div>
      <div className={styles.tabs} role="tablist" aria-label="휴가 전략">
        {STRATEGY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === value}
            className={`${styles.tab} ${tab.id === value ? styles.tabActive : ""}`}
            onClick={() => onChange(tab.id)}
          >
            <span aria-hidden>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
      <p className={styles.description}>{active.description}</p>
    </div>
  );
}
