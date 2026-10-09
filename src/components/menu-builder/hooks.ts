"use client";

import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import type { FormState } from "@/server/actions";
import { holdFocus, useAnnounce } from "./builder-context";

const IDLE: FormState = { status: "idle" };

type Tracked = { state: FormState; saves: number };

const FIRST_FIELD = "input:not([type=hidden]):not([disabled]), textarea, select";

const UNREACHABLE: FormState = {
  status: "error",
  message: "We couldn’t reach DineFlow, so nothing was saved. Check your connection and try again.",
};

/** Runs a Server Action; a dropped connection becomes an error message instead of a crash. */
export async function runAction(call: () => Promise<FormState>): Promise<FormState> {
  try {
    return await call();
  } catch {
    return UNREACHABLE;
  }
}

function firstField(containerId: string): HTMLElement | null {
  return document.getElementById(containerId)?.querySelector<HTMLElement>(FIRST_FIELD) ?? null;
}

/**
 * A menu form backed by a Server Action that returns FormState. Give the <form> the `formId`.
 *
 * The form is submitted through a transition instead of React's form action, because React resets
 * a form after its action runs: this way typed values, ticked boxes and a chosen photo stay in
 * place when a save fails. After a failure, focus moves to the first field with an error; after a
 * success, the message is announced through the builder's status region.
 *
 * `saves` counts successful saves: key a "create" form's fields on it to clear them after each one.
 */
export function useMenuForm(
  action: (prev: FormState, formData: FormData) => Promise<FormState>,
  { formId, onSuccess }: { formId: string; onSuccess?: (message: string) => void },
) {
  const announce = useAnnounce();
  const [tracked, dispatch, pending] = useActionState<Tracked, FormData>(
    async (prev, formData) => {
      const state = await runAction(() => action(prev.state, formData));
      if (state.status === "success") {
        announce(state.message);
        onSuccess?.(state.message);
      }
      return { state, saves: prev.saves + (state.status === "success" ? 1 : 0) };
    },
    { state: IDLE, saves: 0 },
  );

  useEffect(() => {
    if (tracked.state.status !== "error") return;
    document.getElementById(formId)?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [tracked, formId]);

  // After a successful "add", the (re-keyed, empty) form is ready for the next entry.
  useEffect(() => {
    if (tracked.saves === 0) return;
    firstField(formId)?.focus();
  }, [tracked.saves, formId]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  function error(field: string): string | undefined {
    return tracked.state.status === "error" ? tracked.state.fieldErrors?.[field] : undefined;
  }

  return { state: tracked.state, saves: tracked.saves, pending, dispatch, onSubmit, error };
}

/**
 * A button (with id `triggerId`) that shows and hides a panel (with id `panelId`), such as an
 * inline form. Opening moves focus to the panel's first field; closing returns it to the button.
 */
export function useDisclosure(triggerId: string) {
  const [open, setOpen] = useState(false);
  const panelId = `${triggerId}-panel`;

  useEffect(() => {
    if (open) firstField(panelId)?.focus();
  }, [open, panelId]);

  function hide() {
    setOpen(false);
    holdFocus(triggerId);
  }

  return {
    open,
    panelId,
    show: () => setOpen(true),
    hide,
    toggle: () => (open ? hide() : setOpen(true)),
  };
}
