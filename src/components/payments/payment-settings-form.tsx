"use client";

import { useActionState, useState } from "react";
import {
  CheckboxField,
  Fieldset,
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
} from "@/components/ui";
import type { FormState } from "@/server/actions";
import {
  IDLE,
  ONBOARDING_LABELS,
  ONBOARDING_STATUSES,
  isOnboardingStatus,
  type FormAction,
  type PaymentOnboardingStatus,
} from "./model";

export interface SavedPaymentSettings {
  payAtPickupEnabled: boolean;
  onlineEnabled: boolean;
  provider: string | null;
  merchantReference: string | null;
  onboardingStatus: PaymentOnboardingStatus;
  updatedAt: string;
}

/**
 * The payment step of the setup wizard: methods, provider, public merchant reference and
 * onboarding state. Online payment can only be ticked while onboarding is Ready, matching the
 * schema and the database constraint.
 */
export function PaymentSettingsForm({
  save,
  saved,
  nextStep,
}: {
  /** savePaymentSettings bound to the restaurant id, by the page (see FormAction). */
  save: FormAction;
  saved: SavedPaymentSettings;
  /** The wizard's next step, for "Save and continue". */
  nextStep?: { slug: string; label: string };
}) {
  const [state, action] = useActionState<FormState, FormData>(save, IDLE);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? state.values : undefined;
  // Remount the fields with fresh defaults after each save or refused save.
  const formKey = `${saved.updatedAt}|${values ? JSON.stringify(values) : ""}`;

  return (
    <form key={formKey} action={action} noValidate className="flex max-w-content flex-col gap-8">
      <FormMessage state={state} />
      <PaymentFields saved={saved} values={values} errors={errors} />
      <div className="flex flex-wrap items-center gap-3">
        {nextStep ? (
          <>
            <SubmitButton name="then" value={nextStep.slug}>
              Save and continue<span className="sr-only"> to {nextStep.label}</span>
            </SubmitButton>
            <SubmitButton variant="secondary">Save</SubmitButton>
          </>
        ) : (
          <SubmitButton>Save payment settings</SubmitButton>
        )}
      </div>
    </form>
  );
}

function PaymentFields({
  saved,
  values,
  errors,
}: {
  saved: SavedPaymentSettings;
  values: Record<string, string> | undefined;
  errors: Record<string, string>;
}) {
  const initial = values?.onboardingStatus;
  const [status, setStatus] = useState<PaymentOnboardingStatus>(
    isOnboardingStatus(initial) ? initial : saved.onboardingStatus,
  );
  const onlineAllowed = status === "ready";
  // Unticked boxes are absent from submitted values.
  const payAtPickup = values ? "payAtPickupEnabled" in values : saved.payAtPickupEnabled;
  const online = values ? "onlineEnabled" in values : saved.onlineEnabled;

  return (
    <>
      <Fieldset
        legend="How customers can pay"
        hint="Turn on at least one. Changes to a live restaurant apply to new orders straight away."
      >
        <CheckboxField
          id="payAtPickupEnabled"
          label="Pay at pickup"
          hint="Customers pay the restaurant when they collect. Their order shows “Pay at pickup”."
          defaultChecked={payAtPickup}
          error={errors.payAtPickupEnabled}
        />
        <CheckboxField
          // Remounted when onboarding changes, so a locked box is never shown ticked.
          key={onlineAllowed ? "allowed" : "locked"}
          id="onlineEnabled"
          label="Online payment"
          hint={
            onlineAllowed
              ? "Customers pay through the provider when they order. Orders reach the kitchen only after the payment is confirmed."
              : "Available once provider onboarding below is Ready. Until then customers can’t pay online at this restaurant."
          }
          defaultChecked={onlineAllowed && online}
          disabled={!onlineAllowed}
          error={errors.onlineEnabled}
        />
      </Fieldset>

      <Fieldset legend="Payment provider">
        <SelectField
          id="onboardingStatus"
          label="Provider onboarding"
          hint="Ready means the provider has approved this restaurant and DineFlow’s engineers have stored its keys. Moving away from Ready turns online payment off."
          defaultValue={status}
          onChange={(e) => {
            const next = e.currentTarget.value;
            if (isOnboardingStatus(next)) setStatus(next);
          }}
          error={errors.onboardingStatus}
        >
          {ONBOARDING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ONBOARDING_LABELS[s]}
            </option>
          ))}
        </SelectField>
        <TextField
          id="provider"
          label="Provider name"
          optional
          hint="The company that handles online payments, for example M-Pesa."
          defaultValue={values?.provider ?? saved.provider ?? ""}
          error={errors.provider}
          autoComplete="off"
          maxLength={40}
        />
        <TextField
          id="merchantReference"
          label="Merchant reference"
          optional
          hint="A public till or paybill number that customers see on receipts. Never a password, key or PIN."
          defaultValue={values?.merchantReference ?? saved.merchantReference ?? ""}
          error={errors.merchantReference}
          autoComplete="off"
          spellCheck={false}
          maxLength={60}
        />
      </Fieldset>
    </>
  );
}
