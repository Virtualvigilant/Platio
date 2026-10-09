"use client";

import { useState } from "react";
import { Callout, Pill } from "@/components/ui";
import type { FormState } from "@/server/actions";
import { setMenuItemAvailability } from "@/server/menu/actions";
import type { EditableItem, MenuForEditing } from "@/server/menu/queries";
import { ActionButton } from "./action-button";
import { BuilderProvider, useAnnounce } from "./builder-context";
import { count, ids } from "./format";
import { Notice } from "./notice";

/**
 * The counter staff's menu view: every dish on the menu with one large button to mark it sold out
 * or available again. Nothing else on the menu can be changed from here.
 */
export function AvailabilityList({
  restaurantId,
  menu,
}: {
  restaurantId: string;
  menu: MenuForEditing;
}) {
  const sections = menu.categories
    .filter((c) => c.active)
    .map((category) => ({
      category,
      items: menu.items.filter((i) => i.active && i.categoryId === category.id),
    }))
    .filter((s) => s.items.length > 0);
  const dishes = sections.flatMap((s) => s.items);
  const unavailable = dishes.filter((i) => !i.available).length;

  return (
    <BuilderProvider>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p id={ids.top} tabIndex={-1} className="m-0 font-sans text-label text-ink">
            {dishes.length === 0
              ? "No dishes on the menu yet."
              : unavailable === 0
                ? `All ${count(dishes.length, "dish", "dishes")} available`
                : `${unavailable} of ${count(dishes.length, "dish", "dishes")} unavailable`}
          </p>
          <p className="m-0 font-serif text-body-sm text-ink-muted">
            Mark a dish unavailable when it sells out. Customers still see it, labelled, but can’t
            order it until you mark it available again.
          </p>
        </div>

        {dishes.length === 0 ? (
          <Callout tone="info">
            Your restaurant’s owner or manager adds dishes. They appear here once they’re on the
            menu.
          </Callout>
        ) : null}

        {sections.map(({ category, items }) => (
          <section
            key={category.id}
            aria-labelledby={`availability-${category.id}`}
            className="flex flex-col gap-1"
          >
            <h2
              id={`availability-${category.id}`}
              className="m-0 font-sans text-heading text-brand wrap-break-word"
            >
              {category.name}
            </h2>
            <ul className="m-0 flex list-none flex-col p-0">
              {items.map((item) => (
                <AvailabilityRow key={item.id} restaurantId={restaurantId} item={item} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </BuilderProvider>
  );
}

function AvailabilityRow({ restaurantId, item }: { restaurantId: string; item: EditableItem }) {
  const announce = useAnnounce();
  const [notice, setNotice] = useState<FormState | null>(null);

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-line py-3">
      <div className="flex min-w-0 flex-col items-start gap-1">
        <span className="font-sans text-label text-ink wrap-break-word">{item.name}</span>
        {item.available ? (
          <Pill tone="brand" form="outline" glyph="check">
            Available
          </Pill>
        ) : (
          <Pill tone="neutral" form="soft" glyph="slash">
            Unavailable
          </Pill>
        )}
      </div>
      <ActionButton
        size="lg"
        variant={item.available ? "secondary" : "primary"}
        pendingLabel="Saving…"
        action={setMenuItemAvailability.bind(
          null,
          restaurantId,
          item.id,
          item.available ? "unavailable" : "available",
        )}
        onResult={(state) => {
          if (state.status === "success") {
            setNotice(null);
            announce(state.message);
          } else {
            setNotice(state);
          }
        }}
      >
        {item.available ? "Mark unavailable" : "Mark available"}
        <span className="sr-only">: {item.name}</span>
      </ActionButton>
      {notice ? (
        <div className="col-span-2">
          <Notice state={notice} />
        </div>
      ) : null}
    </li>
  );
}
