import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase 클라이언트.
 *
 * 환경변수가 없으면 null을 돌려주고, 앱은 브라우저 전용 로컬 계정으로 동작한다.
 * publishable(anon) 키는 브라우저에 노출되는 것을 전제로 만들어진 공개 키다.
 * 실제 데이터 보호는 이 키가 아니라 Supabase의 RLS 정책이 담당하므로,
 * 테이블마다 RLS를 반드시 켜야 한다.
 */
function readEnv(key: string): string | undefined {
  const value = import.meta.env[key as keyof ImportMetaEnv] as string | undefined;
  return value && value.trim() ? value.trim() : undefined;
}

const url = readEnv("VITE_SUPABASE_URL");
const publishableKey =
  readEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ?? readEnv("VITE_SUPABASE_ANON_KEY");

export const supabase: SupabaseClient | null =
  url && publishableKey
    ? createClient(url, publishableKey, {
        auth: {
          // PKCE는 인가 코드를 쿼리스트링(?code=)으로 돌려준다.
          // HashRouter(#/...)를 쓰고 있으므로 해시를 쓰는 implicit 플로우와 충돌하지 않는다.
          flowType: "pkce",
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;

export const isSupabaseConfigured = supabase !== null;

/** OAuth 후 돌아올 주소. 해시 라우터를 쓰므로 경로까지만 지정한다. */
export function oauthRedirectTo(): string {
  return `${window.location.origin}${window.location.pathname}`;
}
