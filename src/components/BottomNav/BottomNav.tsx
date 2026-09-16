import { NavLink, useLocation } from "react-router-dom";
import styles from "./BottomNav.module.css";

const ITEMS = [
  { to: "/", icon: "🗓️", label: "휴가설계", end: true },
  { to: "/calendar", icon: "📅", label: "전체" },
  { to: "/favorites", icon: "♡", label: "찜한휴가" },
  { to: "/settings", icon: "🦥", label: "MY" },
];

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className={styles.nav}>
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            // "다시 계산"으로 들어온 연차 질문도 휴가설계의 일부로 표시한다.
            `${styles.item} ${isActive || (item.to === "/" && pathname === "/start") ? styles.itemActive : ""}`
          }
        >
          <span className={styles.icon}>{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
