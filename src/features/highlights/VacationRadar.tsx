import styles from "./Highlights.module.css";
import type { MonthRadar } from "./monthlyVacationRadar";

interface VacationRadarProps {
  radar: MonthRadar[];
  year: number;
  selectedMonth?: number;
  onSelectMonth: (month: MonthRadar) => void;
}

export function VacationRadar({ radar, year, selectedMonth, onSelectMonth }: VacationRadarProps) {
  const highlighted = radar.filter((month) => month.highlight);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>📡 {year}년 휴가 레이더</h2>
        <span className={styles.sectionSub}>휴가요정이 쉬기 좋은 달을 찾아봤어요.</span>
      </div>

      <div className={styles.radarGrid}>
        {radar.map((month) => (
          <button
            key={month.month}
            type="button"
            className={[
              styles.month,
              month.level >= 4 ? styles.monthHot : "",
              selectedMonth === month.month ? styles.monthActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={month.level === 0}
            onClick={() => onSelectMonth(month)}
            title={
              month.level === 0
                ? `${month.month}월 · 황금휴가 없음`
                : `${month.month}월 · ${month.label} · 최고 ${month.bestRestDays}일 휴식`
            }
          >
            <span className={styles.monthLabel}>{month.month}월</span>
            <span className={styles.flames}>
              {month.level > 0 ? "🔥".repeat(month.level) : "–"}
            </span>
            <span className={styles.monthMeta}>
              {month.level > 0 ? `최대 ${month.bestRestDays}일` : "기회 없음"}
            </span>
          </button>
        ))}
      </div>

      {highlighted.map((month) => (
        <p key={month.month} className={styles.monthHighlight}>
          🔥 {month.month}월 · {month.highlight}
        </p>
      ))}
    </section>
  );
}
