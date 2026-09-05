import { Navigate, Route, Routes } from "react-router-dom";
import { AdminAuthProvider, useAdminAuth } from "./AdminAuthContext";
import { AdminLogin } from "./AdminLogin";
import { AdminLayout } from "./AdminLayout";
import { DashboardPage } from "../../pages/Admin/DashboardPage";
import { VisitorsPage } from "../../pages/Admin/VisitorsPage";
import { VacationPage } from "../../pages/Admin/VacationPage";
import { TrafficPage } from "../../pages/Admin/TrafficPage";
import { SharePage } from "../../pages/Admin/SharePage";
import { FunnelPage } from "../../pages/Admin/FunnelPage";
import { SeoPage } from "../../pages/Admin/SeoPage";
import { RevenuePage } from "../../pages/Admin/RevenuePage";
import { SystemPage } from "../../pages/Admin/SystemPage";

/**
 * 관리자 앱.
 *
 * 사용자 앱(AppShell)과 완전히 분리된 트리다.
 * - 사용자 화면의 Provider·레이아웃·스타일을 전혀 공유하지 않는다.
 * - 세션 저장 위치도 다르다(adminClient 의 storageKey).
 * 따라서 관리자 기능을 추가하거나 고쳐도 휴가요정 본체가 영향을 받지 않는다.
 */
function AdminGate() {
  const { loading, isAdmin } = useAdminAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f6f6f3",
          color: "#8a9793",
          fontFamily: '"Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif',
          fontSize: 14,
        }}
      >
        확인 중…
      </div>
    );
  }

  // 로그인하지 않았거나 관리자가 아니면 로그인 화면만 보인다.
  // 이건 어디까지나 화면 처리이고, 실제 데이터 보호는 RLS 가 한다.
  if (!isAdmin) return <AdminLogin />;

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="visitors" element={<VisitorsPage />} />
        <Route path="vacation" element={<VacationPage />} />
        <Route path="traffic" element={<TrafficPage />} />
        <Route path="share" element={<SharePage />} />
        <Route path="funnel" element={<FunnelPage />} />
        <Route path="seo" element={<SeoPage />} />
        <Route path="revenue" element={<RevenuePage />} />
        <Route path="system" element={<SystemPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}

export function AdminApp() {
  return (
    <AdminAuthProvider>
      <AdminGate />
    </AdminAuthProvider>
  );
}
