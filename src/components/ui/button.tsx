import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-brand text-on-brand hover:bg-brand-strong",
  secondary: "border-line-strong bg-surface-raised text-ink hover:bg-surface-alt",
  quiet: "border-transparent bg-transparent text-brand-strong hover:bg-brand-soft",
  danger: "border-transparent bg-danger text-on-danger",
};

/** Class names for anything that should look like a Button (e.g. a Link). */
export function buttonClasses({
  variant = "primary",
  size = "md",
  block = false,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; className?: string } = {}) {
  return cn(
    // Tailwind orders utilities by property, not by class order, so each property is set once.
    block ? "flex w-full" : "inline-flex",
    "items-center justify-center gap-2 rounded-sm border font-sans whitespace-nowrap no-underline cursor-pointer",
    "disabled:cursor-not-allowed disabled:bg-neutral-soft disabled:text-ink-muted disabled:border-line aria-busy:cursor-progress",
    size === "lg"
      ? "min-h-touch-kitchen min-w-touch-kitchen px-6 text-[18px] leading-[22px] font-bold"
      : cn("min-h-touch-min min-w-touch-min text-label", variant === "quiet" ? "px-3" : "px-4"),
    VARIANTS[variant],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Disables the button and shows a spinner so a double tap cannot submit twice. */
  loading?: boolean;
  loadingLabel?: ReactNode;
}

export function Button({
  variant,
  size,
  block,
  loading,
  loadingLabel,
  className,
  children,
  type = "button",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, block, className })}
    >
      {loading ? (
        <>
          <span
            aria-hidden="true"
            className="size-4 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin motion-reduce:border-dotted"
          />
          <span>{loadingLabel ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  block,
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize; block?: boolean }) {
  return <Link {...rest} className={buttonClasses({ variant, size, block, className })} />;
}
