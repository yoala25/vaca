import { useEffect, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import styles from "./MobileTopBar.module.css";
import { appIcon } from "../../assets/mascot";
import { useAuth } from "../../features/auth/AuthContext";
import { usePlanner } from "../../state/PlannerContext";
import { track } from "../../features/analytics";

/**
 * 모바일 상단바.
 *
 * 아이콘만으로는 무엇인지 알아보기 어려워서 글자 버튼으로 둔다.
 * - 다시 계산: 계산 결과가 있을 때만 보인다. 누르면 연차 질문(/start)으로 간다.
 * - 우리회사: 회사 휴가제도 설정
 * - 로그인 / 닉네임: 계정 화면(MY). 로그인하면 닉네임이 보인다.
 */
export function MobileTopBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, isSignedIn } = useAuth();
  const { needsLeavePrompt } = usePlanner();
  const barRef = useRef<HTMLElement>(null);

  /*
   * 상단바 높이를 --sticky-top 으로 알려 준다.
   * 홈의 전략 버튼이 이 바로 아래에 붙기 위해 쓴다. 노치(safe-area) 여백이 기기마다
   * 달라서 숫자로 박아 두지 않고 실제 높이를 잰다. 상단바가 없는 화면(PC)에서는
   * 값이 지워져 0으로 돌아간다.
   */
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const root = document.documentElement;
    const apply = () =>
      root.style.setProperty("--sticky-top", `${Math.round(bar.getBoundingClientRect().height)}px`);
    apply();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    observer?.observe(bar);
    return () => {
      observer?.disconnect();
      root.style.removeProperty("--sticky-top");
    };
  }, []);

  // 되돌아갈 계산 결과가 있을 때만 보여 준다. 질문 페이지에서는 의미가 없으므로 숨긴다.
  const canRecalculate = !needsLeavePrompt && pathname !== "/start";
  const accountLabel = isSignedIn && user ? `${user.displayName}님` : "로그인";

  const recalculate = () => {
    track("retry_simulation");
    navigate("/start");
  };

  return (
    <header className={styles.bar} ref={barRef}>
      <button type="button" className={styles.brand} onClick={() => navigate("/")}>
        <span className={styles.brandIcon}>
          <img src={appIcon} alt="" />
        </span>
        <span className={styles.brandName}>휴가요정</span>
      </button>

      <nav className={styles.actions} aria-label="빠른 메뉴">
        {canRecalculate && (
          <button type="button" className={`${styles.pill} ${styles.pillPrimary}`} onClick={recalculate}>
            <span aria-hidden>↺</span>
            다시 계산
          </button>
        )}
        <NavLink
          to="/company"
          className={({ isActive }) => `${styles.pill} ${isActive ? styles.pillActive : ""}`}
        >
          우리회사
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `${styles.pill} ${styles.account} ${isActive ? styles.pillActive : ""}`
          }
          title={isSignedIn ? "계정 설정" : "로그인 / 회원가입"}
        >
          <span className={styles.accountName}>{accountLabel}</span>
        </NavLink>
      </nav>
    </header>
  );
}
