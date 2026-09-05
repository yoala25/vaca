import styles from "./Highlights.module.css";
import { ScoreGauge } from "./ScoreGauge";
import type { VacationChance } from "./vacationRanking";

interface TopChancesProps {
  chances: VacationChance[];
  /** 시뮬레이션 중인 연도. 미래 연도에서는 "올해"라고 하면 안 된다. */
  year: number;
  currentYear: number;
  onOpen: (chance: VacationChance) => void;
  onToggleSave: (chance: VacationChance) => void;
  isSaved: (chance: VacationChance) => boolean;
}

export function TopChances({
  chances,
  year,
  currentYear,
  onOpen,
  onToggleSave,
  isSaved,
}: TopChancesProps) {
  if (chances.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>🧚 휴가요정이 찾았어요!</h2>
        <span className={styles.sectionSub}>
          {year === currentYear ? "올해 남은 기간" : `${year}년`} 중 가장 좋은 조합 {chances.length}개
        </span>
      </div>

      <div className={styles.topGrid}>
        {chances.map((chance, index) => (
          <article
            key={`${chance.category}-${chance.candidate.id}`}
            className={`${styles.card} ${index === 0 ? styles.cardTop : ""}`}
          >
            <div className={styles.cardHead}>
              <span className={styles.medal}>{chance.medal}</span>
              <span className={styles.categoryLabel}>{chance.categoryLabel}</span>
            </div>

            <p className={styles.cardTitle}>
              <span>{chance.emoji}</span>
              {chance.label}
            </p>

            <p className={styles.headline}>
              <span className={styles.headlineLeave}>연차 {chance.leaveDays}일</span>
              <span className={styles.headlineArrow}>→</span>
              <span className={styles.headlineResult}>
                <span className={styles.headlineRest}>{chance.restDays}</span>
                <span className={styles.headlineUnit}>일 휴가</span>
              </span>
            </p>

            <p className={styles.dateRange}>{chance.dateRange}</p>

            <ScoreGauge score={chance.score} />

            <div className={styles.cardActions}>
              <button type="button" className={styles.detailBtn} onClick={() => onOpen(chance)}>
                자세히 보기
              </button>
              <button
                type="button"
                className={`${styles.saveBtn} ${isSaved(chance) ? styles.saveBtnActive : ""}`}
                onClick={() => onToggleSave(chance)}
              >
                {isSaved(chance) ? "♥ 찜함" : "♡ 찜하기"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
