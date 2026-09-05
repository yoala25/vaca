import styles from "./Wallet.module.css";
import { usePlanner } from "../../state/PlannerContext";

/** 올해 화면에서 다음 해로 넘어가는 안내. */
export function NextYearCta() {
  const { selectedYear, availableYears, setSelectedYear } = usePlanner();
  const nextYear = availableYears.find((year) => year > selectedYear);
  if (nextYear === undefined) return null;

  return (
    <div className={styles.previewCta}>
      <span className={styles.previewText}>🧚 내년 휴가도 미리 볼까요?</span>
      <button type="button" className={styles.previewBtn} onClick={() => setSelectedYear(nextYear)}>
        {nextYear}년 휴가 미리보기 →
      </button>
    </div>
  );
}
