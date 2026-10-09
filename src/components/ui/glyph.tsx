import type { ReactNode } from "react";

/**
 * The design system's status glyphs: 16px strokes in currentColor, always paired with a word.
 * Drawn for DineFlow; replace when the product adopts an icon library.
 */
export type GlyphName =
  | "clock"
  | "progress"
  | "bell"
  | "check"
  | "cross"
  | "slash"
  | "alert"
  | "undo"
  | "pause"
  | "dot"
  | "ring";

const PATHS: Record<GlyphName, ReactNode> = {
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  progress: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16h12l-1.6-2.2V10a4.4 4.4 0 0 0-8.8 0v3.8z" />
      <path d="M10.2 18.6a2 2 0 0 0 3.6 0" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  cross: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  slash: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M6.5 17.5l11-11" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </>
  ),
  undo: (
    <>
      <path d="M9 6L5 10l4 4" />
      <path d="M5 10h9.5a4.5 4.5 0 0 1 0 9H11" />
    </>
  ),
  pause: <path d="M9 6.5v11M15 6.5v11" />,
  dot: <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />,
  ring: <circle cx="12" cy="12" r="6" />,
};

export function Glyph({ name, size = 16 }: { name: GlyphName; size?: number }) {
  return (
    <svg
      className="block flex-none"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
