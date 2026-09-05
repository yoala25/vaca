import { useState } from "react";
import styles from "./Wallet.module.css";
import { usePlanner } from "../../state/PlannerContext";
import { getLeaveDays, leaveTypeLabel, entryTypeFor } from "../../data/leaveWallet";

/** 연도별 연차를 한 곳에서 관리한다. 메인에서는 접어두고 필요할 때만 펼친다. */
export function LeaveWalletPanel() {
  const {
    availableYears,
    selectedYear,
    currentYear,
    leaveWallet,
    setLeaveDaysForYear,
    leaveAmountHint,
  } = usePlanner();
  const [editingYear, setEditingYear] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  const startEdit = (year: number, current: number | undefined) => {
    setEditingYear(year);
    setDraft(current === undefined ? "" : String(current));
  };

  const commit = (year: number) => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) setLeaveDaysForYear(year, parsed);
    setEditingYear(null);
  };

  return (
    <section className={styles.wallet}>
      <div className={styles.walletHead}>
        <h2 className={styles.walletTitle}>🧳 내 연차 지갑</h2>
        <span className={styles.walletSub}>연도별로 따로 관리돼요. 언제든 바꿀 수 있어요.</span>
      </div>

      <div className={styles.walletGrid}>
        {availableYears.map((year) => {
          const days = getLeaveDays(leaveWallet, year);
          const type = entryTypeFor(year, currentYear);
          const isEditing = editingYear === year;

          return (
            <div
              key={year}
              className={`${styles.walletRow} ${year === selectedYear ? styles.walletRowActive : ""}`}
            >
              <span className={styles.walletYear}>{year}</span>
              <span className={styles.walletBody}>
                <span className={styles.walletType}>{leaveTypeLabel(type)}</span>
                {isEditing ? (
                  <input
                    className={styles.walletInput}
                    type="number"
                    min={0}
                    max={90}
                    step={0.5}
                    value={draft}
                    autoFocus
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={() => commit(year)}
                    onKeyDown={(event) => event.key === "Enter" && commit(year)}
                    aria-label={`${year}년 연차 일수`}
                  />
                ) : days === undefined ? (
                  <span className={styles.walletEmpty}>아직 입력 전</span>
                ) : (
                  <span className={styles.walletDays}>
                    {type === "expected" ? "✨" : "🪙"} {days}일
                  </span>
                )}
              </span>
              {!isEditing && (
                <button
                  type="button"
                  className={styles.walletEditBtn}
                  onClick={() => startEdit(year, days)}
                >
                  {days === undefined ? "입력" : "수정"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className={styles.walletHint}>{leaveAmountHint}</p>
    </section>
  );
}
