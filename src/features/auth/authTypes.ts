/** 소셜 로그인 제공자. 현재는 구글만 제공한다. */
export type SocialProvider = "google";

/** 이메일 가입 포함 전체 가입 경로. */
export type AuthProviderId = "email" | SocialProvider;

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  provider: AuthProviderId;
  createdAt: string;
}

export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; message: string };

/**
 * 인증 백엔드 경계.
 *
 * 지금은 브라우저 안에서만 도는 LocalAuthStore가 이 인터페이스를 구현한다.
 * 실제 서버(Supabase/Firebase/자체 API)가 붙으면 이 인터페이스만 다시 구현하면 되고
 * 화면 코드는 손대지 않아도 된다.
 */
export interface AuthBackend {
  getCurrentUser(): AuthUser | null;
  signUpWithEmail(email: string, password: string, displayName: string): Promise<AuthResult>;
  signInWithEmail(email: string, password: string): Promise<AuthResult>;
  signOut(): void;
}
