import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./AppShell";
import { useViewport } from "../lib/useViewport";
import { Home } from "../pages/Home/Home";
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

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomeGate />} />
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
