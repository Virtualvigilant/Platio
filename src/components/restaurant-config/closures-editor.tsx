"use client";

import { useActionState } from "react";
import { Fieldset, FormMessage, Glyph, Pill, SubmitButton, TextField } from "@/components/ui";
import { IDLE, errorFor, valueFor, type FormAction } from "./form-state";

/** A closure ready to show: times already formatted in Nairobi time on the server. */
export interface ClosureView {
  id: string;
  starts: string;
  ends: string;
  reason: string | null;
  /** The restaurant is closed by it right now. */
  current: boolean;
}

/**
 * Temporary closures (brief §6.4): date-and-time ranges in Nairobi time when customers can't
 * order, like a public holiday. Upcoming ones are listed with a remove button.
 */
export function ClosuresEditor({
  add,
  remove,
  closures,
}: {
  /** addClosure, bound to the restaurant. */
  add: FormAction;
  /** removeClosure, bound to the restaurant; the closure's id is posted with the form. */
  remove: FormAction;
  closures: ClosureView[];
}) {
  return (
    <div className="flex max-w-content flex-col gap-5">
      {closures.length === 0 ? (
        <p className="m-0 font-serif text-body-sm text-ink-muted">No closures planned.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {closures.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface-raised p-3"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <p className="m-0 font-sans text-label text-ink">
                  {c.starts} to {c.ends}
                </p>
                {c.reason ? (
                  <p className="m-0 font-serif text-body-sm text-ink-muted">{c.reason}</p>
                ) : null}
                {c.current ? (
                  <div>
                    <Pill tone="neutral" form="outline" glyph="slash">
                      Closed now
                    </Pill>
                  </div>
                ) : null}
              </div>
              <RemoveClosure remove={remove} closure={c} />
            </li>
          ))}
        </ul>
      )}
      <AddClosure add={add} />
    </div>
  );
}

function RemoveClosure({ remove, closure }: { remove: FormAction; closure: ClosureView }) {
  const [state, action] = useActionState(remove, IDLE);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="closureId" value={closure.id} />
      <SubmitButton variant="secondary" pendingLabel="Removing…">
        Remove<span className="sr-only"> the closure starting {closure.starts}</span>
      </SubmitButton>
      {state.status === "error" ? (
        <p role="alert" className="m-0 flex items-start gap-1 font-sans text-small text-danger">
          <span className="mt-px">
            <Glyph name="alert" size={14} />
          </span>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function AddClosure({ add }: { add: FormAction }) {
  const [state, action] = useActionState(add, IDLE);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <Fieldset
        legend="Add a closure"
        hint="Times are Nairobi time. Customers can’t order while the restaurant is closed."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="closure-startAt"
            name="startAt"
            label="Starts"
            type="datetime-local"
            step={300}
            defaultValue={valueFor(state, "startAt", "")}
            error={errorFor(state, "startAt")}
          />
          <TextField
            id="closure-endAt"
            name="endAt"
            label="Ends"
            type="datetime-local"
            step={300}
            defaultValue={valueFor(state, "endAt", "")}
            error={errorFor(state, "endAt")}
          />
        </div>
        <TextField
          id="closure-reason"
          name="reason"
          label="Reason"
          optional
          hint="For example, Public holiday or Staff training."
          maxLength={200}
          autoComplete="off"
          defaultValue={valueFor(state, "reason", "")}
          error={errorFor(state, "reason")}
        />
      </Fieldset>
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingLabel="Adding…">Add closure</SubmitButton>
      </div>
    </form>
  );
}
