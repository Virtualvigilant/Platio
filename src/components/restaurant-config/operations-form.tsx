"use client";

import { useActionState } from "react";
import { CheckboxField, Fieldset, FormMessage, TextAreaField, TextField } from "@/components/ui";
import { formatPresets } from "@/domain/restaurants/hours-form";
import { IDLE, checkedFor, errorFor, valueFor, type FormAction } from "./form-state";
import { SaveButtons, type NextStep } from "./parts";

export interface OperationsValues {
  pickupEnabled: boolean;
  dineInEnabled: boolean;
  pickupInstructions: string | null;
  prepPresets: number[];
  defaultPrepMinutes: number;
}

/** How customers order and collect, and the kitchen's preparation-time defaults (§6.4). */
export function OperationsForm({
  save,
  saved,
  nextStep,
  wizard = false,
}: {
  /** saveOperations, bound to the restaurant. */
  save: FormAction;
  saved: OperationsValues;
  nextStep?: NextStep;
  wizard?: boolean;
}) {
  const [state, action] = useActionState(save, IDLE);

  return (
    <form action={action} noValidate className="flex max-w-content flex-col gap-5">
      <Fieldset legend="Order types" hint="Turn on at least one.">
        <CheckboxField
          id="ops-pickupEnabled"
          name="pickupEnabled"
          label="Pickup"
          hint="Customers order ahead and collect at the counter."
          defaultChecked={checkedFor(state, "pickupEnabled", saved.pickupEnabled)}
          error={errorFor(state, "pickupEnabled")}
        />
        <CheckboxField
          id="ops-dineInEnabled"
          name="dineInEnabled"
          label="Dine-in"
          hint="Customers eat at the restaurant. They’ll need instructions to find their table or seat, so add them below."
          defaultChecked={checkedFor(state, "dineInEnabled", saved.dineInEnabled)}
          error={errorFor(state, "dineInEnabled")}
        />
      </Fieldset>

      <TextAreaField
        id="ops-pickupInstructions"
        name="pickupInstructions"
        label="Instructions for customers"
        hint={
          wizard
            ? "Shown after ordering: where to collect, or how to find a seat. Needed before publishing when pickup is on."
            : "Shown after ordering: where to collect, or how to find a seat. Keep these filled in while pickup is on."
        }
        rows={3}
        maxLength={500}
        placeholder="Collect at the side counter and show your pickup code."
        defaultValue={valueFor(state, "pickupInstructions", saved.pickupInstructions)}
        error={errorFor(state, "pickupInstructions")}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="ops-prepPresets"
          name="prepPresets"
          label="Preparation time choices (minutes)"
          hint="The quick choices staff tap when accepting an order. Up to six, separated by commas."
          inputMode="numeric"
          autoComplete="off"
          defaultValue={valueFor(state, "prepPresets", formatPresets(saved.prepPresets))}
          error={errorFor(state, "prepPresets")}
        />
        <TextField
          id="ops-defaultPrepMinutes"
          name="defaultPrepMinutes"
          label="Default preparation time (minutes)"
          hint="Used when a dish has no preparation time of its own. 1 to 120."
          type="number"
          inputMode="numeric"
          min={1}
          max={120}
          step={1}
          defaultValue={valueFor(state, "defaultPrepMinutes", String(saved.defaultPrepMinutes))}
          error={errorFor(state, "defaultPrepMinutes")}
        />
      </div>

      <FormMessage state={state} />
      <SaveButtons label="Save operations" nextStep={nextStep} />
    </form>
  );
}
