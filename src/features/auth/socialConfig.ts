import type { SocialProvider } from "./authTypes";

/**
 * 화면에 노출할 소셜 로그인 버튼 정의.
 *
 * 실제 인가 흐름은 Supabase가 처리하므로 여기에는 표시용 정보만 둔다.
 * 활성화 여부는 앱이 시작할 때 Supabase 설정을 조회해서 판단한다
 * (supabaseAuth.fetchEnabledSocialProviders).
 */
export interface SocialProviderMeta {
  id: SocialProvider;
  label: string;
  background: string;
  color: string;
  border?: string;
  mark: string;
}

export const SOCIAL_PROVIDERS: SocialProviderMeta[] = [
  {
    id: "google",
    label: "구글로 시작하기",
    background: "#ffffff",
    color: "#2b2b28",
    border: "#dadce0",
    mark: "G",
  },
];
