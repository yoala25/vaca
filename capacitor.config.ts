import type { CapacitorConfig } from "@capacitor/cli";

/**
 * 안드로이드 앱 설정.
 *
 * 웹앱(dist)을 그대로 담아 앱 안에서 띄운다. 서버에서 화면을 받아오지 않으므로
 * 비행기 모드에서도 휴가 계산은 그대로 동작한다(로그인·통계만 네트워크가 필요).
 *
 * appId 는 한 번 정하면 바꿀 수 없다. 바꾸면 스토어·기기에서 "다른 앱"이 되어
 * 기존 사용자의 앱이 업데이트되지 않는다.
 */
const config: CapacitorConfig = {
  appId: "io.github.yoala25.hyugayojeong",
  appName: "휴가요정",
  webDir: "dist",
  android: {
    // 구글 로그인 창이 "안전하지 않은 브라우저"로 차단되지 않도록
    // 앱 WebView 가 아니라 시스템 브라우저(사용자 지정 탭)로 띄운다. (src/lib/nativeAuth.ts)
    allowMixedContent: false,
  },
  server: {
    // 앱 안에서 쓰는 주소. https 로 두어야 localStorage·암호화 API 가 제한 없이 동작한다.
    androidScheme: "https",
  },
};

export default config;
