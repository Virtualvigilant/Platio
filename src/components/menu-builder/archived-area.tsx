"use client";

import { useState } from "react";
import { Pill } from "@/components/ui";
import { formatKES } from "@/domain/money";
import type { FormState } from "@/server/actions";
import { deleteCategory, restoreCategory, restoreMenuItem } from "@/server/menu/actions";
import type { EditableCategory, EditableItem } from "@/server/menu/queries";
import { ActionButton, ConfirmButton } from "./action-button";
import { useAnnounce } from "./builder-context";
import { count, ids } from "./format";
import { Notice } from "./notice";

function ArchivedPill() {
  return (
    <Pill tone="neutral" form="outline" glyph="slash">
      Archived
    </Pill>
  );
}

/**
 * Archived categories and dishes, collapsed by default. They're hidden from customers and kept so
 * past orders and reports still make sense; anything here can be restored.
 */
export function ArchivedArea({
  restaurantId,
  categories,
  items,
  itemCountByCategory,
  categoryNames,
}: {
  restaurantId: string;
  /** Archived categories, in menu order. */
  categories: EditableCategory[];
  /** Archived dishes, in menu order. */
  items: EditableItem[];
  /** Every dish (active or archived) per category id, to know which categories are empty. */
  itemCountByCategory: Record<string, number>;
  categoryNames: Record<string, string>;
}) {
  const total = categories.length + items.length;
  // Where focus goes once something leaves this list: back here, or to the top if it's now empty.
  const after = total > 1 ? ids.archived : ids.top;
  const shown = [
    categories.length ? count(categories.length, "archived category", "archived categories") : null,
    items.length ? count(items.length, "archived dish", "archived dishes") : null,
  ]
    .filter(Boolean)
    .join(" and ");

  return (
    <section
      aria-labelledby={ids.archived}
      className="flex flex-col gap-3 border-t border-line pt-6"
    >
      <h2 id={ids.archived} tabIndex={-1} className="m-0 font-sans text-heading text-brand">
        Archived
      </h2>
      <p className="m-0 font-serif text-body-sm text-ink-muted">
        Hidden from customers and kept for past orders and reports. Restore anything to put it back
        on the menu.
      </p>
      <details>
        {/* Kept as a list item so the open/closed marker stays; 12px padding makes it 44px tall. */}
        <summary className="cursor-pointer py-3 font-sans text-label text-brand-strong">
          Show {shown}
        </summary>
        <div className="flex flex-col gap-6 pt-2">
          {categories.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="m-0 font-sans text-label text-ink">Categories</h3>
              <ul className="m-0 flex list-none flex-col p-0">
                {categories.map((c) => (
                  <ArchivedCategoryRow
                    key={c.id}
                    restaurantId={restaurantId}
                    category={c}
                    dishes={itemCountByCategory[c.id] ?? 0}
                    after={after}
                  />
                ))}
              </ul>
            </div>
          ) : null}
          {items.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="m-0 font-sans text-label text-ink">Dishes</h3>
              <ul className="m-0 flex list-none flex-col p-0">
                {items.map((item) => (
                  <ArchivedItemRow
                    key={item.id}
                    restaurantId={restaurantId}
                    item={item}
                    categoryName={categoryNames[item.categoryId] ?? ""}
                    after={after}
                  />
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}

function ArchivedCategoryRow({
  restaurantId,
  category,
  dishes,
  after,
}: {
  restaurantId: string;
  category: EditableCategory;
  dishes: number;
  after: string;
}) {
  const announce = useAnnounce();
  const [notice, setNotice] = useState<FormState | null>(null);
  const context = <span className="sr-only">: {category.name}</span>;

  return (
    <li className="flex flex-col gap-2 border-b border-line py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-sans text-label text-ink wrap-break-word">{category.name}</span>
        <ArchivedPill />
      </div>
      <p className="m-0 font-sans text-small text-ink-muted">
        {dishes === 0
          ? "No dishes."
          : `${count(dishes, "dish", "dishes")}, hidden while the category is archived.`}
      </p>
      <div data-toolbar className="flex flex-wrap gap-2">
        <ActionButton
          variant="secondary"
          pendingLabel="Restoring…"
          action={restoreCategory.bind(null, restaurantId, category.id)}
          onResult={(state) => {
            if (state.status === "success") {
              announce(state.message, [ids.categoryHeading(category.id), after, ids.top]);
            } else {
              setNotice(state);
            }
          }}
        >
          Restore{context}
        </ActionButton>
        {dishes === 0 ? (
          <ConfirmButton
            id={`archived-category-${category.id}-delete`}
            label={<>Delete{context}</>}
            question={`Delete ${category.name}? This can’t be undone.`}
            confirmLabel="Delete category"
            action={deleteCategory.bind(null, restaurantId, category.id)}
            onResult={(state) => {
              if (state.status === "success") announce(state.message, [after]);
              else setNotice(state);
            }}
          />
        ) : null}
      </div>
      <Notice state={notice} />
    </li>
  );
}

function ArchivedItemRow({
  restaurantId,
  item,
  categoryName,
  after,
}: {
  restaurantId: string;
  item: EditableItem;
  categoryName: string;
  after: string;
}) {
  const announce = useAnnounce();
  const [notice, setNotice] = useState<FormState | null>(null);

  return (
    <li className="flex flex-col gap-2 border-b border-line py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-sans text-label text-ink wrap-break-word">{item.name}</span>
        <ArchivedPill />
      </div>
      <p className="m-0 font-sans text-small text-ink-muted">
        <span className="tabular-nums">{formatKES(item.priceMinor)}</span>
        {categoryName ? ` · ${categoryName}` : null}
      </p>
      <div data-toolbar className="flex flex-wrap gap-2">
        <ActionButton
          variant="secondary"
          pendingLabel="Restoring…"
          action={restoreMenuItem.bind(null, restaurantId, item.id)}
          onResult={(state) => {
            if (state.status === "success") {
              announce(state.message, [ids.itemEdit(item.id), after, ids.top]);
            } else {
              setNotice(state);
            }
          }}
        >
          Restore<span className="sr-only">: {item.name}</span>
        </ActionButton>
      </div>
      <Notice state={notice} />
    </li>
  );
}
