import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { supabase } from "./supabaseClient";
import { adminSupabase } from "../admin/adminClient";
import { isNativeApp } from "../../lib/nativeApp";

/**
 * 안드로이드 앱에서 구글 로그인을 마치고 돌아왔을 때 세션을 받아 준다.
 *
 * 흐름: 앱 → 시스템 브라우저에서 구글 로그인 → hyugayojeong://auth?code=... 로 앱 복귀
 *       → 여기서 code 를 세션으로 바꾼다 → 화면이 자동으로 로그인 상태가 된다.
 *
 * 화면을 그리지 않으므로 어디에 두어도 기존 UI 에 영향이 없다.
 * 웹에서는 아무 일도 하지 않는다(웹은 브라우저가 알아서 돌아온다).
 */
export function NativeAuthBridge() {
  useEffect(() => {
    if (!isNativeApp()) return;

    let active = true;

    const handle = async (url: string) => {
      let code: string | null = null;
      let failed: string | null = null;
      try {
        const parsed = new URL(url);
        code = parsed.searchParams.get("code");
        failed = parsed.searchParams.get("error_description") ?? parsed.searchParams.get("error");
      } catch {
        return;
      }

      // 로그인 창은 결과와 무관하게 닫는다.
      try {
        await Browser.close();
      } catch {
        /* 이미 닫혔으면 무시 */
      }

      if (!code) {
        if (failed && import.meta.env.DEV) console.warn("[native-auth]", failed);
        return;
      }

      /*
       * 사용자용·관리자용 클라이언트는 각자 저장소를 쓰므로, 로그인을 시작한 쪽만
       * 코드를 세션으로 바꿀 수 있다. 어느 쪽이 시작했는지 알 수 없으니 차례로 시도한다.
       * 시작하지 않은 쪽은 검증값이 없어 그냥 실패하고 넘어간다.
       */
      for (const client of [supabase, adminSupabase]) {
        if (!client || !active) continue;
        try {
          const { error } = await client.auth.exchangeCodeForSession(code);
          if (!error) return;
        } catch {
          /* 다음 클라이언트로 */
        }
      }
    };

    const listener = App.addListener("appUrlOpen", (event) => {
      void handle(event.url);
    });

    return () => {
      active = false;
      void listener.then((handle) => handle.remove());
    };
  }, []);

  return null;
}
