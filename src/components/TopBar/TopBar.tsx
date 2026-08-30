import { useNavigate } from "react-router-dom";
import styles from "./TopBar.module.css";
import { useUi } from "../../state/UiContext";
import { useAuth } from "../../features/auth/AuthContext";
import { appIcon } from "../../assets/mascot";

export function TopBar() {
  const { toggleSidebar } = useUi();
  const { user, isSignedIn } = useAuth();
  const navigate = useNavigate();

  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.menuBtn}
        aria-label="사이드바 접기/펼치기"
        onClick={toggleSidebar}
      >
        ☰
      </button>
      <div className={styles.right}>
        {/* PC에서 MY(계정) 화면으로 들어가는 유일한 입구다. */}
        <button
          type="button"
          className={styles.profile}
          onClick={() => navigate("/settings")}
          title="MY"
        >
          <span className={styles.avatar}>
            <img src={appIcon} alt="" />
          </span>
          {isSignedIn && user ? `${user.displayName}님` : "로그인 / 회원가입"}
          <span className={styles.chevron}>›</span>
        </button>
      </div>
    </div>
  );
}
