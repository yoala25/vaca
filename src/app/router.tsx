import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./AppShell";
import { useViewport } from "../lib/useViewport";
import { Home } from "../pages/Home/Home";
import { StartPanel } from "../pages/Home/StartPanel";
import { Splash } from "../pages/Splash/Splash";
import { Welcome } from "../pages/Welcome/Welcome";
import { OnboardingStepPage } from "../pages/Onboarding/OnboardingStepPage";
import { CalculatingPage } from "../pages/Onboarding/CalculatingPage";
import { YearCalendarPage } from "../pages/Calendar/YearCalendarPage";
import { CompanyPolicyPage } from "../pages/Company/CompanyPolicyPage";
import { SettingsPage } from "../pages/Settings/SettingsPage";
import { FavoritesPage } from "../pages/Favorites/FavoritesPage";

/**
 * 게스트는 기기와 무관하게 "남은 연차 입력 → 계산하기"(StartPanel)로 시작한다.
 * Home이 hasCalculated를 보고 StartPanel과 시뮬레이터를 직접 전환하므로 여기서는 통과시킨다.
 *
 * 모바일 온보딩 마법사(스플래시→시작→연차→근무요일)는 라우트로 남겨 두고
 * 설정의 "휴가 다시 설계하기"에서 들어갈 수 있다.
 */
function HomeGate() {
  return <Home />;
}

function MobileOnly({ children }: { children: ReactNode }) {
  const { category } = useViewport();
  if (category !== "mobile") return <Navigate to="/" replace />;
  return <>{children}</>;
}

/*
 * 관리자 화면은 따로 떼어 지연 로딩한다.
 * 일반 사용자는 관리자 코드를 한 바이트도 내려받지 않으므로
 * 기존 첫 화면 속도가 그대로 유지된다.
 */
const AdminApp = lazy(() =>
  import("../features/admin/AdminApp").then((module) => ({ default: module.AdminApp })),
);

export function AppRoutes() {
  return (
    <Routes>
      {/*
        관리자 화면은 AppShell 바깥에 둔다.
        사이드바·하단탭·PlannerContext 등 사용자 화면의 구성 요소를
        전혀 거치지 않으므로, 양쪽이 서로에게 영향을 주지 않는다.
      */}
      <Route path="/admin/*" element={<Suspense fallback={null}><AdminApp /></Suspense>} />

      <Route element={<AppShell />}>
        <Route path="/" element={<HomeGate />} />
        {/* "다시 계산" 버튼의 목적지. 계산하지 않고 나가면 이전 결과가 그대로 남는다. */}
        <Route path="/start" element={<StartPanel />} />
        <Route path="/calendar" element={<YearCalendarPage />} />
        <Route path="/company" element={<CompanyPolicyPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        <Route path="/splash" element={<MobileOnly><Splash /></MobileOnly>} />
        <Route path="/welcome" element={<MobileOnly><Welcome /></MobileOnly>} />
        <Route
          path="/onboarding/calculating"
          element={<MobileOnly><CalculatingPage /></MobileOnly>}
        />
        <Route path="/onboarding/:step" element={<MobileOnly><OnboardingStepPage /></MobileOnly>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
