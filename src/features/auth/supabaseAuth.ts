import type { User } from "@supabase/supabase-js";
import { supabase, oauthRedirectTo } from "./supabaseClient";
import type { AuthProviderId, AuthResult, AuthUser, SocialProvider } from "./authTypes";

/** 앱에서 사용하는 소셜 제공자. */
export const SUPABASE_SOCIAL_PROVIDERS: SocialProvider[] = ["google"];

export function toAuthUser(user: User): AuthUser {
  const provider = (user.app_metadata?.provider ?? "email") as AuthProviderId;
  const meta = user.user_metadata ?? {};
  const displayName =
    (meta.name as string) ||
    (meta.full_name as string) ||
    (meta.display_name as string) ||
    (meta.preferred_username as string) ||
    (user.email ? user.email.split("@")[0] : "휴가요정");

  return {
    id: user.id,
    email: user.email ?? "",
    displayName,
    provider,
    createdAt: user.created_at ?? new Date().toISOString(),
  };
}

/** Supabase 오류 메시지를 사용자에게 보여줄 한국어로 바꾼다. */
function translateError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않아요.";
  }
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "이미 가입된 이메일이에요. 로그인해 주세요.";
  }
  if (lower.includes("password should be at least")) {
    return "비밀번호는 6자 이상이어야 해요.";
  }
  if (lower.includes("unable to validate email") || lower.includes("invalid email")) {
    return "이메일 형식을 확인해 주세요.";
  }
  if (lower.includes("email not confirmed")) {
    return "메일함에서 인증 링크를 눌러 가입을 완료해 주세요.";
  }
  if (lower.includes("provider is not enabled")) {
    return "이 로그인 방식이 Supabase에서 아직 활성화되지 않았어요.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "잠시 후 다시 시도해 주세요.";
  }
  return message;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResult & { needsEmailConfirm?: boolean }> {
  if (!supabase) return { ok: false, message: "서버 연결이 설정되지 않았어요." };

  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { name: displayName.trim() || email.split("@")[0] },
      emailRedirectTo: oauthRedirectTo(),
    },
  });

  if (error) return { ok: false, message: translateError(error.message) };
  if (!data.user) return { ok: false, message: "가입에 실패했어요. 다시 시도해 주세요." };

  // 이메일 인증이 켜져 있으면 세션 없이 user만 돌아온다.
  if (!data.session) {
    return {
      ok: false,
      message: "가입 확인 메일을 보냈어요. 메일함에서 인증 링크를 눌러 주세요.",
      needsEmailConfirm: true,
    };
  }

  return { ok: true, user: toAuthUser(data.user) };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, message: "서버 연결이 설정되지 않았어요." };

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) return { ok: false, message: translateError(error.message) };
  if (!data.user) return { ok: false, message: "로그인에 실패했어요." };
  return { ok: true, user: toAuthUser(data.user) };
}

/** 소셜 로그인 시작. 성공하면 제공자 화면으로 이동하므로 반환되지 않는다. */
export async function signInWithSocial(provider: SocialProvider): Promise<string | null> {
  if (!supabase) return "서버 연결이 설정되지 않았어요.";
  if (!SUPABASE_SOCIAL_PROVIDERS.includes(provider)) {
    return "이 로그인 방식은 아직 준비 중이에요.";
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: oauthRedirectTo() },
  });

  return error ? translateError(error.message) : null;
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

/**
 * 프로젝트에서 실제로 켜져 있는 소셜 제공자를 조회한다.
 *
 * 대시보드에서 켜지 않은 제공자로 로그인을 시도하면 Supabase 오류 페이지로 튕긴다.
 * 버튼을 누르기 전에 상태를 알아야 "준비 중"으로 안내할 수 있다.
 */
export async function fetchEnabledSocialProviders(): Promise<SocialProvider[]> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
  if (!url || !key) return [];

  try {
    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    if (!response.ok) return [];
    const settings = (await response.json()) as { external?: Record<string, boolean> };
    return SUPABASE_SOCIAL_PROVIDERS.filter((provider) => settings.external?.[provider] === true);
  } catch {
    return [];
  }
}
