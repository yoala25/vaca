import { useNavigate } from "react-router-dom";
import pageStyles from "../../styles/pageHeader.module.css";
import styles from "./SettingsPage.module.css";
import { appIcon } from "../../assets/mascot";
import { usePlanner } from "../../state/PlannerContext";
import { useAuth } from "../../features/auth/AuthContext";
import { SignUpPanel } from "../../features/auth/SignUpPanel";

const MENU = [
  { icon: "🏢", label: "회사 휴가제도", to: "/company" },
  { icon: "♡", label: "찜한 휴가", to: "/favorites" },
  { icon: "📅", label: "전체 캘린더", to: "/calendar" },
];

const PROVIDER_LABEL: Record<string, string> = {
  email: "이메일",
  google: "구글",
};

const SYNC_TEXT: Record<string, string> = {
  loading: "저장된 정보를 불러오는 중…",
  saving: "저장 중…",
  saved: "내 계정에 저장됨",
  idle: "변경하면 자동으로 저장돼요",
  error: "저장에 실패했어요. 잠시 후 다시 시도해 주세요.",
  unavailable: "서버에 저장 공간(planner_states 테이블)이 아직 없어 이 기기에만 저장돼요.",
};

function SyncBadge({ status }: { status: string }) {
  const isProblem = status === "error" || status === "unavailable";
  return (
    <p className={isProblem ? styles.syncWarn : styles.syncOk}>
      {status === "saved" ? "☁️ " : isProblem ? "⚠️ " : "⏳ "}
      {SYNC_TEXT[status] ?? status}
    </p>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { remainingLeaveDays, totalLeaveDays, workPattern, savedRanges, syncStatus } = usePlanner();
  const { user, isSignedIn, signOut, cloudEnabled } = useAuth();

  return (
    <div className={pageStyles.page}>
      <div>
        <h1 className={pageStyles.title}>MY</h1>
        <p className={pageStyles.desc}>내 정보와 휴가요정 설정을 관리하세요.</p>
      </div>

      {isSignedIn && user ? (
        <>
          <div className={styles.profileCard}>
            <span className={styles.avatar}>
              <img src={appIcon} alt="" />
            </span>
            <div>
              <p className={styles.name}>{user.displayName}님</p>
              <p className={styles.sub}>
                {user.email} · {PROVIDER_LABEL[user.provider] ?? user.provider} 계정
              </p>
              <p className={styles.sub}>
                전체 {totalLeaveDays}일 중 {remainingLeaveDays}일 남음 ·{" "}
                {workPattern === "mon-sat" ? "월~토 근무" : "월~금 근무"} · 찜 {savedRanges.length}건
              </p>
            </div>
          </div>

          <div className={styles.card}>
            {MENU.map((item) => (
              <button
                key={item.label}
                type="button"
                className={styles.row}
                onClick={() => navigate(item.to)}
              >
                <span className={styles.rowIcon}>{item.icon}</span>
                {item.label}
                <span className={styles.chev}>›</span>
              </button>
            ))}
          </div>

          {cloudEnabled && <SyncBadge status={syncStatus} />}

          <button type="button" className={styles.signOutBtn} onClick={signOut}>
            로그아웃
          </button>
        </>
      ) : (
        <>
          <SignUpPanel />

          <div className={styles.card}>
            {MENU.map((item) => (
              <button
                key={item.label}
                type="button"
                className={styles.row}
                onClick={() => navigate(item.to)}
              >
                <span className={styles.rowIcon}>{item.icon}</span>
                {item.label}
                <span className={styles.chev}>›</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
