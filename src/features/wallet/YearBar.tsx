import styles from "./Wallet.module.css";
import { usePlanner } from "../../state/PlannerContext";
import { getLeaveDays } from "../../data/leaveWallet";
import { track } from "../analytics";

/**
 * 연도 탭. 어떤 연도를 시뮬레이션 중인지가 화면에서 가장 먼저 읽혀야 한다.
 * 연차 값 자체는 아래 그리팅 영역에서 크게 보여주므로 여기서는 입력 여부만 표시한다.
 */
export function YearBar({ onToggleWallet }: { onToggleWallet: () => void }) {
  const { selectedYear, availableYears, setSelectedYear, currentYear, leaveWallet } = usePlanner();

  return (
    <div className={styles.yearBar}>
      <div className={styles.yearTabs} role="tablist" aria-label="연도 선택">
        {availableYears.map((year) => {
          const filled = getLeaveDays(leaveWallet, year) !== undefined;
          return (
            <button
              key={year}
              type="button"
              role="tab"
              aria-selected={year === selectedYear}
              className={`${styles.yearTab} ${year === selectedYear ? styles.yearTabActive : ""}`}
              onClick={() => {
                setSelectedYear(year);
                track("year_select", { targetYear: year });
              }}
            >
              {year}
              {year === currentYear ? <span className={styles.yearTag}>올해</span> : null}
              {!filled && year !== currentYear ? <span className={styles.yearDot} aria-label="연차 미입력">·</span> : null}
            </button>
          );
        })}
      </div>

      <button type="button" className={styles.walletToggle} onClick={onToggleWallet}>
        🧳 연차 지갑
      </button>
    </div>
  );
}
