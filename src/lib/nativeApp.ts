import { Capacitor } from "@capacitor/core";

/**
 * 안드로이드 앱(Capacitor)으로 실행 중인지.
 *
 * 웹과 앱에서 달라야 하는 곳은 많지 않다. 지금은 구글 로그인 하나뿐이다.
 * 구글은 앱 내장 브라우저(WebView)에서의 로그인을 "안전하지 않은 브라우저"로
 * 차단하므로, 앱에서는 시스템 브라우저로 로그인하고 앱으로 돌아와야 한다.
 */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * 로그인을 마친 뒤 앱으로 돌아올 주소.
 * AndroidManifest 의 intent-filter, Supabase 의 Redirect URLs 와 같아야 한다.
 */
export const NATIVE_AUTH_REDIRECT = "hyugayojeong://auth";
