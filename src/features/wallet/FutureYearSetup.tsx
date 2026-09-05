import { useState } from "react";
import styles from "./Wallet.module.css";
import { usePlanner } from "../../state/PlannerContext";
import { slothBeach } from "../../assets/mascot";
import { track } from "../analytics";

const QUICK_OPTIONS = [10, 15, 20];

/**
 * 미래 연도를 처음 골랐을 때 보여주는 입력 화면.
 * 빈 추천 화면 대신 예상 연차부터 물어본다.
 * 여기서 값을 넣기 전에는 어떤 기본값도 저장하지 않는다.
 */
export function FutureYearSetup() {
  const { selectedYear, setLeaveDaysForYear: applyLeaveDays } = usePlanner();

  /** 값을 저장하면서 익명 통계도 함께 남긴다. */
  const setLeaveDaysForYear = (year: number, days: number) => {
    applyLeaveDays(year, days);
    track("leave_input", { targetYear: year, leaveDays: days });
    track("simulation_start", { targetYear: year, leaveDays: days });
  };
  const [custom, setCustom] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const parsed = Number(custom);
  const canConfirm = Number.isFinite(parsed) && parsed > 0;

  return (
    <section className={styles.setup}>
      <img className={styles.setupMascot} src={slothBeach} alt="" />
      <h2 className={styles.setupTitle}>{selectedYear}년 휴가를 미리 짜볼까요?</h2>
      <p className={styles.setupDesc}>
        {selectedYear}년에 쓸 수 있을 것 같은 연차를 알려주세요.
        <br />
        정확하지 않아도 괜찮아요. 언제든 바꿀 수 있어요.
      </p>

      <div className={styles.setupChips}>
        {QUICK_OPTIONS.map((days) => (
          <button
            key={days}
            type="button"
            className={styles.setupChip}
            onClick={() => setLeaveDaysForYear(selectedYear, days)}
          >
            {days}일
          </button>
        ))}
        <button
          type="button"
          className={`${styles.setupChip} ${showCustom ? styles.setupChipActive : ""}`}
          onClick={() => setShowCustom(true)}
        >
          직접 입력
        </button>
      </div>

      {showCustom && (
        <div className={styles.setupCustom}>
          <input
            className={styles.setupInput}
            type="number"
            min={0.5}
            max={90}
            step={0.5}
            value={custom}
            autoFocus
            placeholder="15"
            onChange={(event) => setCustom(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canConfirm) setLeaveDaysForYear(selectedYear, parsed);
            }}
            aria-label={`${selectedYear}년 예상 연차 일수`}
          />
          <button
            type="button"
            className={styles.setupConfirm}
            disabled={!canConfirm}
            onClick={() => setLeaveDaysForYear(selectedYear, parsed)}
          >
            시작하기
          </button>
        </div>
      )}
    </section>
  );
}
