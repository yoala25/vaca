import { NavLink } from "react-router-dom";
import styles from "./BottomNav.module.css";

const ITEMS = [
  { to: "/", icon: "🗓️", label: "휴가설계", end: true },
  { to: "/calendar", icon: "📅", label: "전체" },
  { to: "/favorites", icon: "♡", label: "찜한휴가" },
  { to: "/settings", icon: "🦥", label: "MY" },
];

export function BottomNav() {
  return (
    <nav className={styles.nav}>
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `${styles.item} ${isActive ? styles.itemActive : ""}`}
        >
          <span className={styles.icon}>{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
