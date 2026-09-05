import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 관리자 전용 Supabase 클라이언트.
 *
 * 사용자용 클라이언트와 **세션 저장 위치를 분리**한다(storageKey).
 * 그래야 관리자로 로그인해도 일반 사용자 화면의 로그인 상태·저장 데이터가
 * 전혀 영향을 받지 않는다. 기존 서비스를 건드리지 않는 것이 최우선이므로
 * 클라이언트를 하나 더 두는 비용을 감수한다.
 *
 * 키는 사용자용과 같은 publishable(anon) 키다.
 * 관리자 권한은 이 키가 아니라 DB 의 profiles.role + RLS 가 판단한다.
 * service_role 키는 절대 브라우저로 오지 않는다.
 */
function readEnv(key: string): string | undefined {
  const value = import.meta.env[key as keyof ImportMetaEnv] as string | undefined;
  return value && value.trim() ? value.trim() : undefined;
}

const url = readEnv("VITE_SUPABASE_URL");
const publishableKey =
  readEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ?? readEnv("VITE_SUPABASE_ANON_KEY");

export const adminSupabase: SupabaseClient | null =
  url && publishableKey
    ? createClient(url, publishableKey, {
        auth: {
          storageKey: "hyugayojeong-admin-auth",
          persistSession: true,
          autoRefreshToken: true,
          // 관리자 화면은 OAuth 리디렉션을 쓰지 않는다.
          // URL 에서 세션을 주워 담지 않게 해 토큰 주입 여지를 없앤다.
          detectSessionInUrl: false,
          flowType: "pkce",
        },
      })
    : null;

export const isAdminBackendConfigured = adminSupabase !== null;
