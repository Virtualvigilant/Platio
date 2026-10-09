"use client";

import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui";
import type { ButtonProps } from "@/components/ui/button";
import type { FormState } from "@/server/actions";
import { runAction } from "./hooks";

type ActionProps = Omit<ButtonProps, "onClick" | "loading" | "loadingLabel" | "type"> & {
  /** A Server Action with its ids already bound. */
  action: () => Promise<FormState>;
  onResult?: (state: FormState) => void;
  pendingLabel?: ReactNode;
};

/**
 * A one-tap Server Action (archive, move, mark unavailable). It can't be pressed twice while it
 * runs, and gets focus back afterwards if the busy state took it away.
 */
export function ActionButton({ action, onResult, pendingLabel, children, ...button }: ActionProps) {
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const clicked = useRef(false);

  useEffect(() => {
    if (pending || !clicked.current) return;
    clicked.current = false;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const own = wrapRef.current?.querySelector("button");
    const fallback = wrapRef.current
      ?.closest("[data-toolbar]")
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)");
    (own && !own.disabled ? own : fallback)?.focus();
  }, [pending]);

  return (
    <span ref={wrapRef} className="contents">
      <Button
        {...button}
        loading={pending}
        loadingLabel={pendingLabel}
        onClick={() => {
          clicked.current = true;
          startTransition(async () => {
            const state = await runAction(action);
            onResult?.(state);
          });
        }}
      >
        {children}
      </Button>
    </span>
  );
}

/**
 * A destructive action that asks first. The question replaces the button until it's answered;
 * "Keep it" puts focus back on the button.
 */
export function ConfirmButton({
  id,
  label,
  question,
  confirmLabel,
  action,
  onResult,
}: {
  id: string;
  label: ReactNode;
  question: ReactNode;
  confirmLabel: string;
  action: () => Promise<FormState>;
  onResult?: (state: FormState) => void;
}) {
  const [asking, setAsking] = useState(false);
  const questionId = useId();
  const questionRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (asking) questionRef.current?.focus();
  }, [asking]);

  if (!asking) {
    return (
      <Button id={id} variant="quiet" onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  }
  return (
    <div
      role="group"
      aria-labelledby={questionId}
      className="flex basis-full flex-col gap-2 bg-danger-soft px-3 py-3"
    >
      <p id={questionId} ref={questionRef} tabIndex={-1} className="m-0 font-sans text-ui text-ink">
        {question}
      </p>
      <div className="flex flex-wrap gap-2">
        <ActionButton
          variant="danger"
          action={action}
          pendingLabel="Deleting…"
          onResult={(state) => {
            if (state.status === "error") {
              setAsking(false);
              requestAnimationFrame(() => document.getElementById(id)?.focus());
            }
            onResult?.(state);
          }}
        >
          {confirmLabel}
        </ActionButton>
        <Button
          variant="secondary"
          onClick={() => {
            setAsking(false);
            requestAnimationFrame(() => document.getElementById(id)?.focus());
          }}
        >
          Keep it
        </Button>
      </div>
    </div>
  );
}
