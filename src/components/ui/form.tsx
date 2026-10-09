import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";
import { Glyph } from "./glyph";

/**
 * Form building blocks. Every control has a visible label, an optional hint, and an error that is
 * announced and linked with aria-describedby. Errors say what is wrong and how to fix it.
 */

const control =
  "w-full min-h-touch-min rounded-sm border bg-surface-raised px-3 font-sans text-ui text-ink placeholder:text-ink-muted disabled:bg-neutral-soft disabled:text-ink-muted";

export interface FieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  /** Marks the label "(optional)"; required fields carry no marker. */
  optional?: boolean;
  className?: string;
  children: (describedBy: string | undefined, invalid: boolean) => ReactNode;
}

export function Field({ id, label, hint, error, optional, className, children }: FieldProps) {
  const describedBy =
    [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="font-sans text-label text-ink">
        {label}
        {optional ? <span className="font-normal text-ink-muted"> (optional)</span> : null}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="m-0 font-sans text-small text-ink-muted">
          {hint}
        </p>
      ) : null}
      {children(describedBy, !!error)}
      {error ? (
        <p
          id={`${id}-error`}
          className="m-0 flex items-start gap-1 font-sans text-small text-danger"
        >
          <span className="mt-px">
            <Glyph name="alert" size={14} />
          </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}

type Common = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
};

export function TextField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  ...input
}: Common & Omit<InputHTMLAttributes<HTMLInputElement>, "id">) {
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      className={className}
    >
      {(describedBy, invalid) => (
        <input
          id={id}
          name={input.name ?? id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(control, invalid ? "border-danger" : "border-line-strong")}
          {...input}
        />
      )}
    </Field>
  );
}

export function TextAreaField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  rows = 3,
  ...area
}: Common & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id">) {
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      className={className}
    >
      {(describedBy, invalid) => (
        <textarea
          id={id}
          name={area.name ?? id}
          rows={rows}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            control,
            "py-2 font-serif text-body",
            invalid ? "border-danger" : "border-line-strong",
          )}
          {...area}
        />
      )}
    </Field>
  );
}

export function SelectField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
  ...select
}: Common & Omit<SelectHTMLAttributes<HTMLSelectElement>, "id">) {
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      className={className}
    >
      {(describedBy, invalid) => (
        <select
          id={id}
          name={select.name ?? id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(control, invalid ? "border-danger" : "border-line-strong")}
          {...select}
        >
          {children}
        </select>
      )}
    </Field>
  );
}

/** A checkbox with its label beside it; the whole row is a 44px target. */
export function CheckboxField({
  id,
  label,
  hint,
  error,
  className,
  ...input
}: Omit<Common, "optional"> & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type">) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label
        htmlFor={id}
        className="flex min-h-touch-min cursor-pointer items-center gap-3 font-sans text-ui text-ink"
      >
        <input
          id={id}
          name={input.name ?? id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") ||
            undefined
          }
          className="size-5 flex-none accent-brand"
          {...input}
        />
        <span>{label}</span>
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="m-0 pl-8 font-sans text-small text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="m-0 pl-8 font-sans text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A group of related fields with a legend, e.g. one weekday's opening periods. */
export function Fieldset({
  legend,
  hint,
  className,
  children,
}: {
  legend: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={cn("m-0 flex min-w-0 flex-col gap-3 border-0 p-0", className)}>
      <legend className="mb-1 p-0 font-sans text-label text-ink">{legend}</legend>
      {hint ? <p className="m-0 font-sans text-small text-ink-muted">{hint}</p> : null}
      {children}
    </fieldset>
  );
}

/** The result of the last submit. Success is announced politely; errors assertively. */
export function FormMessage({
  state,
}: {
  state:
    | { status: "idle" }
    | { status: "success"; message: string }
    | { status: "error"; message: string };
}) {
  if (state.status === "idle") return null;
  const ok = state.status === "success";
  return (
    <p
      role={ok ? "status" : "alert"}
      className={cn(
        "m-0 flex items-start gap-2 px-3 py-2 font-sans text-ui",
        ok ? "bg-brand-soft text-brand-strong" : "bg-danger-soft text-danger",
      )}
    >
      <span className="mt-0.5">
        <Glyph name={ok ? "check" : "alert"} size={16} />
      </span>
      {state.message}
    </p>
  );
}
