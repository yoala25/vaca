import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { appIcon, slothBeach } from "../../assets/mascot";

const NAV_ITEMS = [
  { to: "/", icon: "🗓️", label: "휴가 설계", end: true },
  { to: "/calendar", icon: "📅", label: "전체 캘린더" },
  { to: "/favorites", icon: "♡", label: "찜한 휴가" },
  { to: "/company", icon: "🏢", label: "회사 휴가제도" },
];

export function Sidebar({ variant = "full" }: { variant?: "full" | "rail" }) {
  const isRail = variant === "rail";

  return (
    <aside className={`${styles.sidebar} ${isRail ? styles.rail : ""}`}>
      <div className={styles.brand}>
        <span className={styles.brandIcon}>
          <img src={appIcon} alt="휴가요정" />
        </span>
        <span className={styles.brandText}>
          <span className={styles.brandTitle}>휴가요정</span>
          <span className={styles.brandCaption}>내 연차를 가장 잘 쓰는 방법</span>
        </span>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.navItemActive : ""}`
            }
            title={isRail ? item.label : undefined}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className={styles.spacer} />

      <div className={styles.footerCard}>
        <p className={styles.footerCaption}>오늘도 잘 쉬어볼까요?</p>
        <span className={styles.footerImg}>
          <img src={slothBeach} alt="" />
        </span>
      </div>
    </aside>
  );
}
