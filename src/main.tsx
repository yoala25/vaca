import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./styles/global.css";
import { AuthProvider } from "./features/auth/AuthContext";
import { PlannerProvider } from "./state/PlannerContext";
import { UiProvider } from "./state/UiContext";
import { AppRoutes } from "./app/router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/*
      HashRouter를 쓰는 이유:
      - dist/index.html을 파일로 직접 열어도(file://) 라우팅이 동작한다.
      - 정적 호스팅에서 서버 rewrite 설정 없이도 URL 새로고침이 항상 정상 동작한다.
      백엔드가 생겨 서버 rewrite를 붙이면 BrowserRouter로 되돌리면 된다.
    */}
    <HashRouter>
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
