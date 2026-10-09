"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./button";

/** A submit button that shows progress and can't be pressed twice while its form is saving. */
export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  ...props
}: Omit<ButtonProps, "type" | "loading" | "loadingLabel"> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} type="submit" loading={pending} loadingLabel={pendingLabel}>
      {children}
    </Button>
  );
}
