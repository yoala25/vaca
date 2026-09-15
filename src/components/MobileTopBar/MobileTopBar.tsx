import { useEffect, useRef } from "react";
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

  return (
    <header className={styles.bar} ref={barRef}>
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
