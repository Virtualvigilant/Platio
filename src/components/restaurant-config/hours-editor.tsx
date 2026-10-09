"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import {
  Button,
  CheckboxField,
  FormMessage,
  Glyph,
  SubmitButton,
  TextField,
} from "@/components/ui";
import {
  MAX_PERIODS_PER_DAY,
  WEEKDAY_NAMES,
  daysFromIntervals,
  daysFromValues,
  hoursField,
  type DayHours,
  type Interval,
} from "@/domain/restaurants/hours-form";
import type { FormState } from "@/server/actions";
import { IDLE, errorFor, type FormAction } from "./form-state";

/**
 * The weekly opening hours editor (brief §6.4): Monday to Sunday, each day closed or open for up
 * to three periods (for a lunch break, say). Overnight periods aren't supported. The whole week is
 * saved at once with set_restaurant_hours().
 *
 * The days are controlled state, so the form is submitted from onSubmit without React's automatic
 * reset; the server action still works as a plain form post before JavaScript loads.
 */
export function HoursEditor({
  save,
  saved,
}: {
  /** saveHours, bound to the restaurant. */
  save: FormAction;
  saved: Interval[];
}) {
  const [state, dispatch] = useActionState(save, IDLE);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  }

  return (
    <form action={dispatch} onSubmit={submit} noValidate className="flex flex-col gap-4">
      {saved.length === 0 ? (
        <p className="m-0 max-w-content font-serif text-body-sm text-ink">
          No opening hours yet. For each day the restaurant opens, untick “Closed all day” and enter
          the times.
        </p>
      ) : null}
      {/* Re-read the saved week whenever it changes on the server. */}
      <Week key={JSON.stringify(saved)} saved={saved} state={state} />
      <FormMessage state={state} />
      <div>
        <SubmitButton>Save opening hours</SubmitButton>
      </div>
    </form>
  );
}

function Week({ saved, state }: { saved: Interval[]; state: FormState }) {
  const [days, setDays] = useState<DayHours[]>(() =>
    state.status === "error" && state.values
      ? daysFromValues(state.values)
      : daysFromIntervals(saved),
  );

  const update = (weekday: number, change: (day: DayHours) => DayHours) =>
    setDays((all) => all.map((d) => (d.weekday === weekday ? change(d) : d)));

  const monday = days.find((d) => d.weekday === 1);
  const copyMonday = () => {
    if (!monday) return;
    setDays((all) =>
      all.map((d) => ({
        weekday: d.weekday,
        closed: monday.closed,
        periods: monday.periods.map((p) => ({ ...p })),
      })),
    );
  };

  const formError = errorFor(state, "_form");

  return (
    <div className="flex flex-col gap-4">
      {formError ? (
        <p role="alert" className="m-0 flex items-start gap-1 font-sans text-small text-danger">
          <span className="mt-px">
            <Glyph name="alert" size={14} />
          </span>
          {formError}
        </p>
      ) : null}
      <div>
        <Button variant="secondary" onClick={copyMonday}>
          Use Monday’s hours every day
        </Button>
      </div>
      <ol className="m-0 flex list-none flex-col border-t border-line p-0">
        {days.map((day) => (
          <li key={day.weekday} className="border-b border-line py-4">
            <Day day={day} state={state} update={(change) => update(day.weekday, change)} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Day({
  day,
  state,
  update,
}: {
  day: DayHours;
  state: FormState;
  update: (change: (day: DayHours) => DayHours) => void;
}) {
  const name = WEEKDAY_NAMES[day.weekday];
  const dayError = errorFor(state, hoursField.day(day.weekday));
  const canAdd = day.periods.length < MAX_PERIODS_PER_DAY;

  return (
    <fieldset
      className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0"
      aria-describedby={dayError ? `${hoursField.day(day.weekday)}-error` : undefined}
    >
      <legend className="mb-1 p-0 font-sans text-label text-ink">{name}</legend>
      <CheckboxField
        id={hoursField.closed(day.weekday)}
        label="Closed all day"
        checked={day.closed}
        onChange={(e) => {
          const closed = e.currentTarget.checked;
          update((d) => ({
            ...d,
            closed,
            // Opening a day with no periods yet gives one empty period to fill in.
            periods:
              !closed && d.periods.length === 0 ? [{ opensAt: "", closesAt: "" }] : d.periods,
          }));
        }}
      />

      {day.closed ? null : (
        <>
          {day.periods.map((period, index) => (
            <div key={index} className="flex flex-wrap items-end gap-3">
              <TextField
                id={hoursField.opens(day.weekday, index)}
                label="Opens"
                type="time"
                step={300}
                className="w-36"
                value={period.opensAt}
                onChange={(e) => {
                  const opensAt = e.currentTarget.value;
                  update((d) => ({
                    ...d,
                    periods: d.periods.map((p, i) => (i === index ? { ...p, opensAt } : p)),
                  }));
                }}
                error={errorFor(state, hoursField.opens(day.weekday, index))}
              />
              <TextField
                id={hoursField.closes(day.weekday, index)}
                label="Closes"
                type="time"
                step={300}
                className="w-36"
                value={period.closesAt}
                onChange={(e) => {
                  const closesAt = e.currentTarget.value;
                  update((d) => ({
                    ...d,
                    periods: d.periods.map((p, i) => (i === index ? { ...p, closesAt } : p)),
                  }));
                }}
                error={errorFor(state, hoursField.closes(day.weekday, index))}
              />
              <Button
                variant="quiet"
                onClick={() =>
                  update((d) => {
                    const periods = d.periods.filter((_, i) => i !== index);
                    // Removing the last period closes the day rather than leaving it empty.
                    return { ...d, periods, closed: periods.length === 0 };
                  })
                }
              >
                Remove
                <span className="sr-only">
                  {" "}
                  {name} period {index + 1}
                </span>
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              disabled={!canAdd}
              onClick={() =>
                update((d) => ({ ...d, periods: [...d.periods, { opensAt: "", closesAt: "" }] }))
              }
            >
              Add a period<span className="sr-only"> on {name}</span>
            </Button>
            <p className="m-0 font-sans text-small text-ink-muted">
              {canAdd
                ? "Up to three a day, for example to close over lunch."
                : "That’s the most periods for one day."}
            </p>
          </div>
        </>
      )}

      {dayError ? (
        <p
          id={`${hoursField.day(day.weekday)}-error`}
          className="m-0 flex items-start gap-1 font-sans text-small text-danger"
        >
          <span className="mt-px">
            <Glyph name="alert" size={14} />
          </span>
          {dayError}
        </p>
      ) : null}
    </fieldset>
  );
}
