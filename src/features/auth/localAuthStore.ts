import type { AuthBackend, AuthResult, AuthUser } from "./authTypes";

/**
 * 브라우저 안에서만 동작하는 계정 저장소.
 *
 * ⚠️ 이건 서버가 붙기 전까지 쓰는 로컬 전용 구현이다.
 *   - 계정 정보가 이 브라우저의 localStorage에만 남는다(다른 기기·브라우저에서 못 본다).
 *   - 비밀번호는 PBKDF2로 해싱해 저장하지만, 클라이언트 저장소는 어차피 사용자가 열어볼 수 있다.
 *   - 따라서 "진짜 인증"이 아니라 계정별로 데이터를 나눠 담는 장치로만 취급해야 한다.
 * 실제 서비스에서는 AuthBackend를 서버 구현으로 교체해야 한다.
 */

const ACCOUNTS_KEY = "hyugayojeong-accounts-v1";
const SESSION_KEY = "hyugayojeong-session-v1";
const PBKDF2_ITERATIONS = 150_000;

interface StoredAccount extends AuthUser {
  /** 이메일 가입 계정만 사용. 소셜 계정은 비밀번호가 없다. */
  saltHex?: string;
  hashHex?: string;
  iterations?: number;
}

function readAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as StoredAccount[]) : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: StoredAccount[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function toPublicUser(account: StoredAccount): AuthUser {
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    provider: account.provider,
    createdAt: account.createdAt,
  };
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isCryptoAvailable(): boolean {
  return typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";
}

async function derivePasswordHash(
  password: string,
  saltHex: string,
  iterations: number,
): Promise<string> {
  const encoder = new TextEncoder();
  const salt = Uint8Array.from(saltHex.match(/.{2}/g) ?? [], (byte) => parseInt(byte, 16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return toHex(bits);
}

function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return toHex(array.buffer);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "비밀번호는 8자 이상이어야 해요.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "영문과 숫자를 모두 포함해 주세요.";
  }
  return null;
}

export const localAuthStore: AuthBackend = {
  getCurrentUser() {
    try {
      const userId = localStorage.getItem(SESSION_KEY);
      if (!userId) return null;
      const account = readAccounts().find((item) => item.id === userId);
      return account ? toPublicUser(account) : null;
    } catch {
      return null;
    }
  },

  async signUpWithEmail(email, password, displayName): Promise<AuthResult> {
    if (!isCryptoAvailable()) {
      return { ok: false, message: "이 브라우저에서는 계정 생성을 지원하지 않아요." };
    }
    const normalized = normalizeEmail(email);
    if (!validateEmail(normalized)) return { ok: false, message: "이메일 형식을 확인해 주세요." };

    const passwordError = validatePassword(password);
    if (passwordError) return { ok: false, message: passwordError };

    const accounts = readAccounts();
    if (accounts.some((item) => item.email === normalized)) {
      return { ok: false, message: "이미 가입된 이메일이에요. 로그인해 주세요." };
    }

    const saltHex = randomHex(16);
    const hashHex = await derivePasswordHash(password, saltHex, PBKDF2_ITERATIONS);
    const account: StoredAccount = {
      id: `user_${randomHex(8)}`,
      email: normalized,
      displayName: displayName.trim() || normalized.split("@")[0],
      provider: "email",
      createdAt: new Date().toISOString(),
      saltHex,
      hashHex,
      iterations: PBKDF2_ITERATIONS,
    };

    writeAccounts([...accounts, account]);
    localStorage.setItem(SESSION_KEY, account.id);
    return { ok: true, user: toPublicUser(account) };
  },

  async signInWithEmail(email, password): Promise<AuthResult> {
    if (!isCryptoAvailable()) {
      return { ok: false, message: "이 브라우저에서는 로그인을 지원하지 않아요." };
    }
    const normalized = normalizeEmail(email);
    const account = readAccounts().find((item) => item.email === normalized);
    // 계정 존재 여부를 알려주지 않는다(사용자 열거 방지).
    const genericError = { ok: false as const, message: "이메일 또는 비밀번호가 올바르지 않아요." };
    if (!account || !account.saltHex || !account.hashHex) return genericError;

    const hashHex = await derivePasswordHash(
      password,
      account.saltHex,
      account.iterations ?? PBKDF2_ITERATIONS,
    );
    if (hashHex !== account.hashHex) return genericError;

    localStorage.setItem(SESSION_KEY, account.id);
    return { ok: true, user: toPublicUser(account) };
  },

  signOut() {
    localStorage.removeItem(SESSION_KEY);
  },
};
