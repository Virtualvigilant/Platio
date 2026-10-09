import type { ReactNode } from "react";
import { SubmitButton, cn } from "@/components/ui";
import { WIZARD_STEPS, type WizardStepSlug } from "@/domain/restaurants/wizard";

/** One titled block of settings: a form or a list, with a short explanation. */
export function ConfigSection({
  id,
  title,
  description,
  className,
  children,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn("flex min-w-0 scroll-mt-4 flex-col gap-4", className)}
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="m-0 font-sans text-heading text-brand">
          {title}
        </h2>
        {description ? (
          <p className="m-0 max-w-content font-serif text-body-sm text-ink-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** The wizard's next step, for "Save and continue". */
export interface NextStep {
  slug: string;
  label: string;
}

export function nextStepAfter(slug: WizardStepSlug): NextStep | undefined {
  const next = WIZARD_STEPS[WIZARD_STEPS.findIndex((s) => s.slug === slug) + 1];
  return next ? { slug: next.slug, label: next.label } : undefined;
}

/** The top of a wizard step page: "Step 3 of 8", the step's name as the page heading, a lede. */
export function StepHeader({ slug, children }: { slug: WizardStepSlug; children?: ReactNode }) {
  const index = WIZARD_STEPS.findIndex((s) => s.slug === slug);
  return (
    <div className="flex flex-col gap-1">
      <p className="m-0 font-sans text-small text-ink-muted">
        Step {index + 1} of {WIZARD_STEPS.length}
      </p>
      <h1 className="m-0 font-sans text-title text-ink">{WIZARD_STEPS[index].label}</h1>
      {children ? (
        <p className="m-0 max-w-content font-serif text-body text-ink-muted">{children}</p>
      ) : null}
    </div>
  );
}

/**
 * Save buttons for a form. In the wizard, "Save and continue" posts then=<next step> and the
 * action moves on after saving; elsewhere there is a single save button.
 */
export function SaveButtons({ label = "Save", nextStep }: { label?: string; nextStep?: NextStep }) {
  if (!nextStep) return <SubmitButton>{label}</SubmitButton>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SubmitButton name="then" value={nextStep.slug}>
        Save and continue<span className="sr-only"> to {nextStep.label}</span>
      </SubmitButton>
      <SubmitButton variant="secondary">{label}</SubmitButton>
    </div>
  );
}

/** "Needed before publishing" note shown on fields the readiness checklist depends on. */
export const NEEDED_TO_PUBLISH = "Needed before publishing.";
