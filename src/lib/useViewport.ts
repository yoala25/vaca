import { useEffect, useState } from "react";

export type ViewportCategory = "mobile" | "tablet" | "desktop" | "wide";

function categoryFor(width: number): ViewportCategory {
  if (width < 768) return "mobile";
  if (width < 1200) return "tablet";
  if (width < 1600) return "desktop";
  return "wide";
}

interface Viewport {
  width: number;
  height: number;
  category: ViewportCategory;
  isPortrait: boolean;
}

function readViewport(): { width: number; height: number } {
  if (typeof window === "undefined") return { width: 1280, height: 800 };
  return { width: window.innerWidth, height: window.innerHeight };
}

export function useViewport(): Viewport {
  const [size, setSize] = useState(readViewport);

  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setSize(readViewport()));
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      cancelAnimationFrame(frame);
    };
  }, []);

  return {
    width: size.width,
    height: size.height,
    category: categoryFor(size.width),
    isPortrait: size.height >= size.width,
  };
}
