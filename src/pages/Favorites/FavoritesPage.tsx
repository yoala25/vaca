import { useNavigate } from "react-router-dom";
import pageStyles from "../../styles/pageHeader.module.css";
import styles from "./FavoritesPage.module.css";
import { slothBeach } from "../../assets/mascot";
import { usePlanner } from "../../state/PlannerContext";
import { formatDateRange } from "../../domain/vacation";

export function FavoritesPage() {
  const navigate = useNavigate();
  const { savedRanges, toggleSavedRange } = usePlanner();

  return (
    <div className={pageStyles.page}>
      <div>
        <h1 className={pageStyles.title}>찜한 휴가</h1>
        <p className={pageStyles.desc}>마음에 드는 휴가 조합을 모아뒀어요.</p>
      </div>

      {savedRanges.length === 0 ? (
        <div className={styles.empty}>
          {/*
            해먹 그림(sloth-hammock)은 아래쪽이 잘린 채 저장돼 있어 네모로 뚝 끊겨 보였다.
            온전한 그림으로 바꾸고, 가장자리는 다른 화면들과 같은 방식으로 배경에 녹인다.
          */}
          <img className={styles.mascot} src={slothBeach} alt="" />
          <p className={styles.emptyTitle}>아직 찜한 조합이 없어요</p>
          <p className={styles.emptyDesc}>
            달력에서 마음에 드는 조합을 고르고 &lsquo;이 조합 저장&rsquo;을 눌러보세요!
          </p>
          <button type="button" className={styles.emptyCta} onClick={() => navigate("/calendar")}>
            📅 달력 보러 가기
          </button>
        </div>
      ) : (
        <div className={styles.list}>
          {savedRanges.map((range) => (
            <article key={range.candidateId} className={styles.card}>
              <span className={styles.emoji}>{range.emoji}</span>
              <div className={styles.body}>
                <p className={styles.cardTitle}>{range.label}</p>
                <p className={styles.headline}>{range.headline}</p>
                <p className={styles.range}>
                  {formatDateRange(range.startDate, range.endDate)} · 휴가효율 {range.efficiency}x
                </p>
                <p className={styles.description}>{range.description}</p>
              </div>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => toggleSavedRange(range)}
              >
                삭제
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
