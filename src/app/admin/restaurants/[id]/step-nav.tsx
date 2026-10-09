"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useEffect, useRef } from "react";
import { Pill, cn } from "@/components/ui";
import { WIZARD_STEPS, type WizardStepSlug } from "@/domain/restaurants/wizard";

export type StepStates = Record<WizardStepSlug, "done" | "todo" | "none">;

/**
 * The setup wizard's steps (brief §7.2). A row that scrolls sideways on phones, a sidebar list on
 * wide screens. Each step with checklist items says whether they pass, as a word and a glyph.
 */
export function StepNav({ restaurantId, states }: { restaurantId: string; states: StepStates }) {
  const segment = useSelectedLayoutSegment();
  const listRef = useRef<HTMLOListElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  // Keep the current step in view in the sideways-scrolling row on phones (without moving the
  // page vertically).
  useEffect(() => {
    const list = listRef.current;
    const active = activeRef.current;
    if (!list || !active || list.scrollWidth <= list.clientWidth) return;
    const box = list.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    if (item.left < box.left || item.right > box.right) {
      list.scrollLeft += item.left - box.left - 16;
    }
  }, [segment]);

  return (
    <nav aria-label="Setup steps" className="min-w-0">
      <ol
        ref={listRef}
        className="m-0 flex list-none gap-1 overflow-x-auto p-0 pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
      >
        {WIZARD_STEPS.map((step, index) => {
          const active = segment === step.slug;
          const state = states[step.slug];
          return (
            <li key={step.slug} className="flex-none">
              <Link
                ref={active ? activeRef : undefined}
                href={`/admin/restaurants/${restaurantId}/${step.slug}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-touch-min items-center gap-2 rounded-sm border px-3 py-1 font-sans text-label whitespace-nowrap no-underline lg:whitespace-normal",
                  active
                    ? "border-brand bg-brand-soft text-ink"
                    : "border-transparent text-ink-muted hover:bg-surface-alt hover:text-ink",
                )}
              >
                <span className="tabular-nums">{index + 1}.</span>
                <span className="lg:flex-1">{step.label}</span>
                {state === "done" ? (
                  <Pill tone="brand" form="soft" glyph="check">
                    Done
                  </Pill>
                ) : state === "todo" ? (
                  <Pill tone="neutral" form="outline" glyph="ring">
                    To do
                  </Pill>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
