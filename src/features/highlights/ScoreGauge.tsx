import styles from "./Highlights.module.css";
import type { VacationScore } from "./vacationScore";

/** 숫자만 보여주지 않고 게이지를 함께 보여준다. */
export function ScoreGauge({ score }: { score: VacationScore }) {
  return (
    <div>
      <div className={styles.scoreRow}>
        <span className={styles.scoreValue}>
          휴가 효율 {score.score}점 {"🔥".repeat(score.grade.flames)}
        </span>
        <span className={styles.scoreGrade}>{score.grade.label}</span>
      </div>
      <div
        className={styles.gauge}
        role="meter"
        aria-valuenow={score.score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="휴가 효율 점수"
      >
        <span className={styles.gaugeFill} style={{ width: `${score.score}%` }} />
      </div>
      <p className={styles.leverage}>연차 1일 = {score.leverage}일 휴식</p>
    </div>
  );
}
