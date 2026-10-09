import localFont from "next/font/local";

// Self-hosted latin subsets of the brief's two faces (both SIL Open Font License).
// The CSS variables feed --font-serif and --font-sans in src/styles/tokens.css.
export const notoSerif = localFont({
  src: [
    { path: "./fonts/NotoSerif-latin.woff2", weight: "400 700", style: "normal" },
    { path: "./fonts/NotoSerif-Italic-latin.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-noto-serif",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const carlito = localFont({
  src: [
    { path: "./fonts/Carlito-Regular-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Carlito-Bold-latin.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-carlito",
  display: "swap",
  fallback: ["Lato", "Calibri", "Segoe UI", "system-ui", "sans-serif"],
});
