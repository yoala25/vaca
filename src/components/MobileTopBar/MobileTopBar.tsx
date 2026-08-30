import { NavLink, useNavigate } from "react-router-dom";
import styles from "./MobileTopBar.module.css";
import { appIcon } from "../../assets/mascot";

/**
 * 모바일에는 좌측 사이드바를 두지 않는다.
 * 자주 쓰는 메뉴는 하단 탭에, 나머지는 이 상단바의 아이콘으로 배치한다.
 */
const TOP_ACTIONS = [
  { to: "/company", icon: "🏢", label: "회사 휴가제도" },
  { to: "/settings", icon: "⚙", label: "설정" },
];

export function MobileTopBar() {
  const navigate = useNavigate();

  return (
    <header className={styles.bar}>
      <button type="button" className={styles.brand} onClick={() => navigate("/")}>
        <span className={styles.brandIcon}>
          <img src={appIcon} alt="" />
        </span>
        <span className={styles.brandName}>휴가요정</span>
      </button>

      <nav className={styles.actions}>
        {TOP_ACTIONS.map((action) => (
          <NavLink
            key={action.to}
            to={action.to}
            className={({ isActive }) =>
              `${styles.iconBtn} ${isActive ? styles.iconBtnActive : ""}`
            }
            aria-label={action.label}
            title={action.label}
          >
            <span aria-hidden>{action.icon}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
