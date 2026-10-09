"use client";

import { useState } from "react";
import { Button, TextField } from "@/components/ui";

/**
 * A read-only link with a Copy link button. If the browser won't copy (no clipboard access, an
 * insecure page, a refused permission), the link is selected so it can be copied by hand.
 */
export function CopyLinkField({ id, label, value }: { id: string; label: string; value: string }) {
  const [result, setResult] = useState<"idle" | "copied" | "failed">("idle");

  function selectLink() {
    const input = document.getElementById(id);
    if (input instanceof HTMLInputElement) {
      input.focus();
      input.select();
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setResult("copied");
    } catch {
      selectLink();
      setResult("failed");
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
        <TextField
          id={id}
          name={id}
          label={label}
          value={value}
          readOnly
          spellCheck={false}
          autoComplete="off"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1"
        />
        <Button onClick={copy}>Copy link</Button>
      </div>
      <p role="status" className="m-0 min-h-5 font-sans text-small text-ink-muted">
        {result === "copied"
          ? "Link copied."
          : result === "failed"
            ? "We couldn’t copy it for you. The link is selected: copy it with your keyboard, or press and hold to copy."
            : ""}
      </p>
    </div>
  );
}
