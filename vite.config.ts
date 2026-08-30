import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * STANDALONE=1 로 빌드하면 JS/CSS/이미지를 전부 인라인한 HTML 한 장을 만든다.
 * 브라우저는 file:// 에서 외부 스크립트·스타일시트를 CORS로 차단하므로,
 * "파일을 더블클릭해서 여는" 사용법을 지원하려면 단일 파일이어야 한다.
 */
const standalone = process.env.STANDALONE === "1";

// https://vite.dev/config/
export default defineConfig({
  // 상대 경로여야 file:// 이나 하위 경로 배포에서도 에셋을 찾는다.
  base: "./",
  plugins: [react(), ...(standalone ? [viteSingleFile()] : [])],
  build: {
    outDir: standalone ? "dist-standalone" : "dist",
    // 단일 파일 빌드에서는 이미지까지 data URI로 인라인한다.
    assetsInlineLimit: standalone ? Number.MAX_SAFE_INTEGER : 4096,
  },
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    environment: "node",
  },
});
