import { useState, type FormEvent } from "react";
import styles from "./AdminLogin.module.css";
import { useAdminAuth } from "./AdminAuthContext";
import { appIcon } from "../../assets/mascot";

/**
 * 관리자 로그인.
 *
 * 로그인하지 않은 사람에게는 이 화면만 보인다.
 * 다만 "화면을 숨기는 것"은 보안이 아니다 — 실제 방어는 Supabase RLS 와
 * admin_guard() 다. 이 화면을 우회해 API 를 직접 불러도 데이터는 나오지 않는다.
 */
export function AdminLogin() {
  const { signIn, pending, configured } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setError(null);
    const message = await signIn(email, password);
    if (message) setError(message);
  };

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={submit}>
        <img className={styles.icon} src={appIcon} alt="" />
        <h1 className={styles.title}>휴가요정 관리자</h1>
        <p className={styles.desc}>관리자 계정으로 로그인하세요.</p>

        {!configured && (
          <p className={styles.warn}>
            서버 연결이 설정되지 않았습니다. <code>.env.local</code> 의 Supabase 값을 확인하세요.
          </p>
        )}

        <label className={styles.field}>
          <span className={styles.label}>이메일</span>
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
            disabled={!configured || pending}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>비밀번호</span>
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            disabled={!configured || pending}
          />
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button className={styles.submit} type="submit" disabled={!configured || pending}>
          {pending ? "확인 중…" : "로그인"}
        </button>

        <a className={styles.backLink} href="#/">
          ← 휴가요정으로 돌아가기
        </a>
      </form>
    </div>
  );
}
