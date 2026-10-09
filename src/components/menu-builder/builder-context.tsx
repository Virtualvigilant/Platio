"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

/**
 * Says what just happened, for screen readers, and moves keyboard focus somewhere sensible when
 * the thing the person acted on disappears (an archived dish leaves its category, a restored one
 * reappears elsewhere).
 */
type Announce = (message: string, focusIds?: readonly string[]) => void;

const AnnounceContext = createContext<Announce>(() => {});

/** How long to wait for a focus target that only appears once the page has refreshed. */
const FOCUS_WAIT_MS = 1500;

/**
 * Focuses the first id that exists. The first id may name something the refresh is about to
 * render, so it is waited for; the others are fallbacks that already exist.
 */
function focusFirst(ids: readonly string[]) {
  if (ids.length === 0) return;
  const deadline = performance.now() + FOCUS_WAIT_MS;
  const tick = () => {
    const preferred = document.getElementById(ids[0]);
    if (preferred) {
      preferred.focus();
      return;
    }
    if (performance.now() < deadline) {
      requestAnimationFrame(tick);
      return;
    }
    for (const id of ids.slice(1)) {
      const fallback = document.getElementById(id);
      if (fallback) {
        fallback.focus();
        return;
      }
    }
  };
  tick();
}

/**
 * Focuses the element with `id` and, while the page refreshes, focuses it again if the refresh
 * re-renders it somewhere else (a dish moved to another category) and focus falls to the page.
 * Stops as soon as focus is somewhere else on purpose.
 */
export function holdFocus(id: string) {
  document.getElementById(id)?.focus();
  const deadline = performance.now() + FOCUS_WAIT_MS;
  const tick = () => {
    const active = document.activeElement;
    if (!active || active === document.body) document.getElementById(id)?.focus();
    else if (active.id !== id) return;
    if (performance.now() < deadline) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function BuilderProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const announce = useCallback<Announce>((next, focusIds = []) => {
    // A repeated message must still change the live region's text to be read out again.
    setMessage((previous) => (previous === next ? `${next} ` : next));
    focusFirst(focusIds);
  }, []);

  return (
    <AnnounceContext value={announce}>
      <p role="status" className="sr-only">
        {message}
      </p>
      {children}
    </AnnounceContext>
  );
}

export function useAnnounce(): Announce {
  return useContext(AnnounceContext);
}
