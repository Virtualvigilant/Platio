"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import {
  Callout,
  CheckboxField,
  FormMessage,
  RestaurantStatusPill,
  SubmitButton,
  TextField,
} from "@/components/ui";
import { errorFor } from "@/components/restaurant-config/form-state";
import { slugify } from "@/domain/restaurants/slug";
import { createRestaurant, type NewRestaurantState } from "./actions";

const START: NewRestaurantState = { status: "idle" };

/**
 * Name and web address for a new draft. The address follows the name until it is edited by hand.
 * Controlled fields, submitted from onSubmit, so nothing typed is cleared after a warning.
 */
export function NewRestaurantForm() {
  const [state, dispatch] = useActionState(createRestaurant, START);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [createAnyway, setCreateAnyway] = useState(false);

  const suggested = slugify(name);
  const shownSlug = slugEdited ? slug : suggested;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  const similar = state.similar ?? [];

  return (
    <form action={dispatch} onSubmit={submit} noValidate className="flex flex-col gap-5">
      <TextField
        id="new-displayName"
        name="displayName"
        label="Display name"
        hint="The name customers will see, like Mama Oliech Kitchen."
        maxLength={80}
        autoComplete="off"
        required
        value={name}
        onChange={(e) => {
          setName(e.currentTarget.value);
          setCreateAnyway(false);
        }}
        error={errorFor(state, "displayName")}
      />

      <TextField
        id="new-slug"
        name="slug"
        label="Web address"
        hint={
          <>
            Customers will find it at{" "}
            <span className="break-all">/restaurants/{shownSlug || "…"}</span>. Lowercase letters,
            numbers and hyphens. You can change it until the restaurant is published.
          </>
        }
        maxLength={60}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={shownSlug}
        onChange={(e) => {
          setSlug(e.currentTarget.value.toLowerCase());
          setSlugEdited(true);
          setCreateAnyway(false);
        }}
        error={errorFor(state, "slug")}
      />
      {slugEdited && suggested && slug !== suggested ? (
        <div>
          <button
            type="button"
            className="min-h-touch-min cursor-pointer bg-transparent p-0 text-left font-sans text-label break-all text-brand-strong underline"
            onClick={() => {
              setSlugEdited(false);
              setSlug("");
            }}
          >
            Use the suggested address, /restaurants/{suggested}
          </button>
        </div>
      ) : null}

      {similar.length > 0 ? (
        <Callout tone="warning" title="Similar restaurants already exist">
          <p className="mb-2">Check that you’re not adding one of these again.</p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {similar.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link href={`/admin/restaurants/${r.id}`}>{r.displayName}</Link>
                <span className="font-sans text-small text-ink-muted break-all">
                  /restaurants/{r.slug}
                </span>
                <RestaurantStatusPill status={r.status} />
              </li>
            ))}
          </ul>
        </Callout>
      ) : null}

      {similar.length > 0 ? (
        <CheckboxField
          id="new-createAnyway"
          name="createAnyway"
          label="Create anyway: this is a different business"
          checked={createAnyway}
          onChange={(e) => setCreateAnyway(e.currentTarget.checked)}
          error={createAnyway ? undefined : errorFor(state, "createAnyway")}
        />
      ) : null}

      <FormMessage state={state} />
      <div>
        <SubmitButton pendingLabel="Creating…">Create draft</SubmitButton>
      </div>
    </form>
  );
}
