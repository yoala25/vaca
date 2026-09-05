import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./styles/global.css";
import { AuthProvider } from "./features/auth/AuthContext";
import { PlannerProvider } from "./state/PlannerContext";
import { UiProvider } from "./state/UiContext";
import { AppRoutes } from "./app/router";
import { AnalyticsTracker } from "./features/analytics";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/*
      HashRouter를 쓰는 이유:
      - dist/index.html을 파일로 직접 열어도(file://) 라우팅이 동작한다.
      - 정적 호스팅에서 서버 rewrite 설정 없이도 URL 새로고침이 항상 정상 동작한다.
      백엔드가 생겨 서버 rewrite를 붙이면 BrowserRouter로 되돌리면 된다.
    */}
    <HashRouter>
      {/*
        익명 페이지뷰 기록. UI를 그리지 않으므로 화면에 아무 영향이 없고,
        Supabase가 꺼져 있으면 조용히 아무 일도 하지 않는다.
      */}
      <AnalyticsTracker />
      <AuthProvider>
        <PlannerProvider>
          <UiProvider>
            <AppRoutes />
          </UiProvider>
        </PlannerProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
);
