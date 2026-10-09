"use client";

import { useActionState } from "react";
import { Fieldset, FormMessage, TextAreaField, TextField } from "@/components/ui";
import { saveLocation } from "@/server/restaurant-config/actions";
import { IDLE, errorFor, valueFor } from "./form-state";
import { SaveButtons, type NextStep } from "./parts";

export interface LocationValues {
  address: string | null;
  serviceArea: string | null;
  directions: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Where customers find the restaurant (wizard step 3, and the owner's settings). */
export function LocationForm({
  restaurantId,
  saved,
  nextStep,
  wizard = false,
}: {
  restaurantId: string;
  saved: LocationValues;
  nextStep?: NextStep;
  /** In the setup wizard, say what the publish checklist needs. */
  wizard?: boolean;
}) {
  const [state, action] = useActionState(saveLocation.bind(null, restaurantId), IDLE);
  const coordinate = (v: number | null) => (v === null ? "" : String(v));

  return (
    <form action={action} noValidate className="flex max-w-content flex-col gap-5">
      {wizard ? (
        <p className="m-0 font-serif text-body-sm text-ink-muted">
          Needed before publishing: an address or a service area.
        </p>
      ) : null}
      <TextField
        id="location-address"
        name="address"
        label="Address"
        optional
        hint="Building, street or landmark, like Student Centre, ground floor."
        maxLength={200}
        autoComplete="off"
        defaultValue={valueFor(state, "address", saved.address)}
        error={errorFor(state, "address")}
      />
      <TextField
        id="location-serviceArea"
        name="serviceArea"
        label="Service area"
        optional
        hint="The campus or neighbourhood customers know it by, like Main campus."
        maxLength={80}
        autoComplete="off"
        defaultValue={valueFor(state, "serviceArea", saved.serviceArea)}
        error={errorFor(state, "serviceArea")}
      />
      <TextAreaField
        id="location-directions"
        name="directions"
        label="Directions"
        optional
        hint="How to find the counter once on site. Shown on the restaurant page."
        rows={3}
        maxLength={500}
        defaultValue={valueFor(state, "directions", saved.directions)}
        error={errorFor(state, "directions")}
      />
      <Fieldset
        legend="Map position"
        hint="Optional. Sorting restaurants by distance needs both numbers. In a map app, press and hold the spot to copy them."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="location-latitude"
            name="latitude"
            label="Latitude"
            hint="Between -90 and 90, like -1.279"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={valueFor(state, "latitude", coordinate(saved.latitude))}
            error={errorFor(state, "latitude")}
          />
          <TextField
            id="location-longitude"
            name="longitude"
            label="Longitude"
            hint="Between -180 and 180, like 36.816"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={valueFor(state, "longitude", coordinate(saved.longitude))}
            error={errorFor(state, "longitude")}
          />
        </div>
      </Fieldset>
      <FormMessage state={state} />
      <SaveButtons label="Save location" nextStep={nextStep} />
    </form>
  );
}
