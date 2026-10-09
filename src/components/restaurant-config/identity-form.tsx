"use client";

import { useActionState } from "react";
import { Fieldset, FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/ui";
import type { FormState } from "@/server/actions";
import { IDLE, errorFor, valueFor, type FormAction } from "./form-state";
import { NEEDED_TO_PUBLISH, SaveButtons, type NextStep } from "./parts";

export interface ProfileValues {
  description: string | null;
  cuisineTags: string[];
  publicPhone: string | null;
}

export interface IdentityValues extends ProfileValues {
  displayName: string;
  slug: string;
  legalName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

/** Description, cuisine labels and public phone: shared by the wizard and the owner's settings. */
function ProfileFields({
  idPrefix,
  state,
  saved,
  wizard = false,
}: {
  idPrefix: string;
  state: FormState;
  saved: ProfileValues;
  /** In the setup wizard, fields the publish checklist needs say so. */
  wizard?: boolean;
}) {
  const needed = wizard ? ` ${NEEDED_TO_PUBLISH}` : "";
  return (
    <>
      <TextAreaField
        id={`${idPrefix}-description`}
        name="description"
        label="Description"
        hint={`A sentence or two about the food, shown on the restaurant page. Up to 500 characters.${needed}`}
        rows={4}
        maxLength={500}
        defaultValue={valueFor(state, "description", saved.description)}
        error={errorFor(state, "description")}
      />
      <TextField
        id={`${idPrefix}-cuisineTags`}
        name="cuisineTags"
        label="Cuisine labels"
        hint={`Separate them with commas, like Kenyan, Fish, Vegetarian. Up to 8.${needed}`}
        autoComplete="off"
        defaultValue={valueFor(state, "cuisineTags", saved.cuisineTags.join(", "))}
        error={errorFor(state, "cuisineTags")}
      />
      <TextField
        id={`${idPrefix}-publicPhone`}
        name="publicPhone"
        label="Public phone number"
        optional
        hint="Shown to customers, like +254 712 345 678."
        type="tel"
        autoComplete="off"
        inputMode="tel"
        maxLength={20}
        defaultValue={valueFor(state, "publicPhone", saved.publicPhone)}
        error={errorFor(state, "publicPhone")}
      />
    </>
  );
}

/** Wizard step 1 (platform staff): everything that identifies the restaurant. */
export function IdentityForm({
  save,
  saved,
  slugLocked,
  nextStep,
}: {
  /** saveIdentity, bound to the restaurant. */
  save: FormAction;
  saved: IdentityValues;
  /** True once the restaurant has been published: the web address can't change any more. */
  slugLocked: boolean;
  nextStep?: NextStep;
}) {
  const [state, action] = useActionState(save, IDLE);

  return (
    <form action={action} noValidate className="flex max-w-content flex-col gap-5">
      <TextField
        id="identity-displayName"
        name="displayName"
        label="Display name"
        hint="The name customers see."
        maxLength={80}
        autoComplete="off"
        required
        defaultValue={valueFor(state, "displayName", saved.displayName)}
        error={errorFor(state, "displayName")}
      />

      {slugLocked ? (
        <div className="flex flex-col gap-1.5">
          <p className="m-0 font-sans text-label text-ink">Web address</p>
          <p className="m-0 font-sans text-ui text-ink break-all">
            <code>/restaurants/{saved.slug}</code>
          </p>
          <p className="m-0 font-sans text-small text-ink-muted">
            The web address can’t change after the restaurant has been published, so links customers
            have saved keep working.
          </p>
        </div>
      ) : (
        <TextField
          id="identity-slug"
          name="slug"
          label="Web address"
          hint={
            <>
              Customers find the restaurant at /restaurants/<em>web-address</em>. Use lowercase
              letters, numbers and hyphens. It can’t change once the restaurant is published.
            </>
          }
          maxLength={60}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={valueFor(state, "slug", saved.slug)}
          error={errorFor(state, "slug")}
        />
      )}

      <ProfileFields idPrefix="identity" state={state} saved={saved} wizard />

      <div className="border-t border-line pt-5">
        <Fieldset
          legend="Private details"
          hint="Only DineFlow staff and the restaurant’s owners and managers see these. They’re never shown to customers."
        >
          <TextField
            id="identity-legalName"
            name="legalName"
            label="Legal or trading name"
            optional
            maxLength={120}
            autoComplete="off"
            defaultValue={valueFor(state, "legalName", saved.legalName)}
            error={errorFor(state, "legalName")}
          />
          <TextField
            id="identity-contactEmail"
            name="contactEmail"
            label="Contact email"
            optional
            hint="Where DineFlow reaches the business about onboarding and payments."
            type="email"
            inputMode="email"
            autoComplete="off"
            maxLength={254}
            defaultValue={valueFor(state, "contactEmail", saved.contactEmail)}
            error={errorFor(state, "contactEmail")}
          />
          <TextField
            id="identity-contactPhone"
            name="contactPhone"
            label="Contact phone"
            optional
            type="tel"
            inputMode="tel"
            autoComplete="off"
            maxLength={20}
            defaultValue={valueFor(state, "contactPhone", saved.contactPhone)}
            error={errorFor(state, "contactPhone")}
          />
        </Fieldset>
      </div>

      <FormMessage state={state} />
      <SaveButtons nextStep={nextStep} />
    </form>
  );
}

/** The owner's own profile fields on /restaurant/settings. */
export function ProfileForm({
  save,
  saved,
}: {
  /** saveProfile, bound to the restaurant. */
  save: FormAction;
  saved: ProfileValues;
}) {
  const [state, action] = useActionState(save, IDLE);
  return (
    <form action={action} noValidate className="flex max-w-content flex-col gap-5">
      <ProfileFields idPrefix="profile" state={state} saved={saved} />
      <FormMessage state={state} />
      <div>
        <SubmitButton>Save profile</SubmitButton>
      </div>
    </form>
  );
}
