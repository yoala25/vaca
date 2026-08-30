import { Outlet, useLocation } from "react-router-dom";
import styles from "./AppShell.module.css";
import { useViewport } from "../lib/useViewport";
import { Sidebar } from "../components/Sidebar/Sidebar";
import { BottomNav } from "../components/BottomNav/BottomNav";
import { TopBar } from "../components/TopBar/TopBar";
import { MobileTopBar } from "../components/MobileTopBar/MobileTopBar";
import { useUi } from "../state/UiContext";

function isChromeLessRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/welcome") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/splash")
  );
}

export function AppShell() {
  const { category, isPortrait } = useViewport();
  const { pathname } = useLocation();
  const { sidebarCollapsed } = useUi();

  // 세로로 든 태블릿은 좌측 레일보다 상단바+하단탭이 자연스럽다.
  // PC(1200px 이상)는 항상 사이드바를 유지한다.
  const useMobileShell = category === "mobile" || (category === "tablet" && isPortrait);

  if (isChromeLessRoute(pathname)) {
    return (
      <div className={styles.fullScreen}>
        <div className={styles.fullScreenCard}>
          <Outlet />
        </div>
      </div>
    );
  }

  if (useMobileShell) {
    return (
      <div className={styles.mobileShell}>
        <MobileTopBar />
        <div className={styles.mobileBody}>
          <Outlet />
        </div>
        <BottomNav />
      </div>
    );
  }

  const useRail = category === "tablet" || sidebarCollapsed;

  return (
    <div className={styles.shell}>
      <Sidebar variant={useRail ? "rail" : "full"} />
      <main className={styles.main}>
        <div className={styles.mainInner}>
          <TopBar />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
