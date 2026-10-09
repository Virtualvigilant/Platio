"use client";

import { useActionState } from "react";
import { CheckboxField, FormMessage, Glyph, SubmitButton, TextAreaField } from "@/components/ui";
import type { RestaurantStatus } from "@/domain/restaurants/lifecycle";
import { IDLE, type FormState } from "@/server/actions";
import { transitionRestaurant } from "./actions";
import { MAX_REASON, type LifecycleMove } from "./moves";

/**
 * One form per lifecycle move the viewer may make, plus a note for each move only super-admins
 * can make. The forms share one result, so the outcome stays on screen after the status changes
 * and the form that was used is replaced by the next status's moves.
 */
export function LifecycleForms({
  restaurantId,
  status,
  moves,
}: {
  restaurantId: string;
  status: RestaurantStatus;
  moves: readonly LifecycleMove[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    (prev, formData) =>
      transitionRestaurant(restaurantId, String(formData.get("to") ?? ""), prev, formData),
    IDLE,
  );

  const allowed = moves.filter((m) => m.allowed);
  const denied = moves.filter((m) => !m.allowed);
  // An error belongs to the form it came from, if that form is still on the page.
  const errorTo =
    state.status === "error" && allowed.some((m) => m.to === state.values?.to)
      ? state.values?.to
      : null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {state.status !== "idle" && !errorTo ? <FormMessage state={state} /> : null}

      {allowed.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {allowed.map((move) => (
            <li key={move.to}>
              <MoveForm
                move={move}
                status={status}
                action={formAction}
                state={errorTo === move.to ? state : IDLE}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {denied.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {denied.map((move) => (
            <li
              key={move.to}
              className="flex items-start gap-2 font-sans text-small text-ink-muted"
            >
              <span className="mt-0.5">
                <Glyph name="slash" size={14} />
              </span>
              {move.deniedNote}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function MoveForm({
  move,
  status,
  action,
  state,
}: {
  move: LifecycleMove;
  status: RestaurantStatus;
  action: (formData: FormData) => void;
  state: FormState;
}) {
  const id = `move-${move.to}`;
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};
  const blockedId = `${id}-blocked`;

  return (
    <form
      action={action}
      noValidate
      aria-labelledby={`${id}-title`}
      className="flex min-w-0 flex-col gap-3 rounded-md border border-line bg-surface-raised p-4"
    >
      <input type="hidden" name="to" value={move.to} />
      <input type="hidden" name="from" value={status} />
      <h3 id={`${id}-title`} className="m-0 font-sans text-label text-ink">
        {move.action}
      </h3>
      <p className="m-0 max-w-content font-serif text-body-sm text-ink">{move.consequence}</p>

      {move.requiresReason ? (
        <TextAreaField
          id={`${id}-reason`}
          name="reason"
          label="Reason"
          hint="Kept in the change log. Only platform staff can see it."
          maxLength={MAX_REASON}
          aria-required="true"
          defaultValue={values.reason ?? ""}
          error={errors.reason}
        />
      ) : null}

      {move.confirm ? (
        <CheckboxField
          id={`${id}-confirm`}
          name="confirm"
          label={move.confirm}
          defaultChecked={values.confirm === "on"}
          error={errors.confirm}
        />
      ) : null}

      {move.blockedNote ? (
        <p
          id={blockedId}
          className="m-0 flex items-start gap-2 font-sans text-small text-amber-strong"
        >
          <span className="mt-0.5">
            <Glyph name="alert" size={14} />
          </span>
          {move.blockedNote}
        </p>
      ) : null}

      <FormMessage state={state} />

      <div>
        <SubmitButton
          variant={move.variant}
          disabled={!!move.blockedNote}
          aria-describedby={move.blockedNote ? blockedId : undefined}
          pendingLabel="Changing status…"
        >
          {move.action}
        </SubmitButton>
      </div>
    </form>
  );
}
