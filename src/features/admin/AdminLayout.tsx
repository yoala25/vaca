import { useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import styles from "./Admin.module.css";
import { useAdminAuth } from "./AdminAuthContext";
import { PeriodContext, PERIOD_PRESETS, resolvePeriod, type PeriodId } from "./usePeriod";
import { appIcon } from "../../assets/mascot";

const NAV = [
  { to: "/admin", end: true, icon: "📊", label: "대시보드" },
  { to: "/admin/visitors", icon: "👣", label: "방문자" },
  { to: "/admin/vacation", icon: "🌴", label: "휴가 분석" },
  { to: "/admin/traffic", icon: "🧭", label: "유입 분석" },
  { to: "/admin/share", icon: "🔗", label: "공유 분석" },
  { to: "/admin/funnel", icon: "🪜", label: "퍼널" },
  { to: "/admin/seo", icon: "🔍", label: "SEO" },
  { to: "/admin/revenue", icon: "💰", label: "수익화" },
  { to: "/admin/system", icon: "⚙️", label: "시스템" },
];

/** 오늘 날짜를 <input type="date"> 형식으로. */
function todayInput(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function AdminLayout() {
  const { email, signOut } = useAdminAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const [periodId, setPeriodId] = useState<PeriodId>("30d");
  const [custom, setCustom] = useState({ from: todayInput(), to: todayInput() });
  const [refreshToken, setRefreshToken] = useState(0);

  const periodValue = useMemo(
    () => ({
      id: periodId,
      range: resolvePeriod(periodId, custom),
      custom,
      setPeriod: setPeriodId,
      setCustom,
      refreshToken,
      refresh: () => setRefreshToken((n) => n + 1),
    }),
    [periodId, custom, refreshToken],
  );

  return (
    <PeriodContext.Provider value={periodValue}>
      <div className={styles.admin}>
        <div className={styles.shell}>
          {menuOpen && (
            <button
              type="button"
              className={styles.backdrop}
              aria-label="메뉴 닫기"
              onClick={() => setMenuOpen(false)}
            />
          )}

          <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}>
            <div className={styles.brand}>
              <img className={styles.brandMascot} src={appIcon} alt="" />
              <span className={styles.brandText}>
                <span className={styles.brandTitle}>휴가요정</span>
                <span className={styles.brandSub}>관리자 대시보드</span>
              </span>
            </div>

            <nav>
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`
                  }
                  onClick={() => setMenuOpen(false)}
                >
                  <span className={styles.navIcon} aria-hidden>
                    {item.icon}
                  </span>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className={styles.sidebarFoot}>
              <span className={styles.adminEmail}>{email ?? "관리자"}</span>
              <button type="button" className={styles.signOutBtn} onClick={() => void signOut()}>
                로그아웃
              </button>
            </div>
          </aside>

          <main className={styles.main}>
            <div className={styles.topBar}>
              <button
                type="button"
                className={styles.menuBtn}
                onClick={() => setMenuOpen(true)}
                aria-label="메뉴 열기"
              >
                ☰
              </button>

              <div className={styles.periodRow}>
                {PERIOD_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`${styles.periodBtn} ${
                      periodId === preset.id ? styles.periodBtnActive : ""
                    }`}
                    onClick={() => setPeriodId(preset.id)}
                  >
                    {preset.label}
                  </button>
                ))}

                {periodId === "custom" && (
                  <span className={styles.customRow}>
                    <input
                      className={styles.dateInput}
                      type="date"
                      value={custom.from}
                      max={custom.to}
                      onChange={(event) =>
                        setCustom((c) => ({ ...c, from: event.target.value }))
                      }
                      aria-label="시작일"
                    />
                    <span>~</span>
                    <input
                      className={styles.dateInput}
                      type="date"
                      value={custom.to}
                      min={custom.from}
                      onChange={(event) => setCustom((c) => ({ ...c, to: event.target.value }))}
                      aria-label="종료일"
                    />
                  </span>
                )}
              </div>

              <span className={styles.spacer} />

              <button
                type="button"
                className={styles.refreshBtn}
                onClick={periodValue.refresh}
                title="지금 다시 불러오기"
              >
                ↻ 새로고침
              </button>
            </div>

            <Outlet />
          </main>
        </div>
      </div>
    </PeriodContext.Provider>
  );
}
