"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import type { FormState } from "@/server/actions";
import { archiveCategory, deleteCategory, moveCategory } from "@/server/menu/actions";
import type { EditableCategory, EditableItem, EditableModifierGroup } from "@/server/menu/queries";
import { ActionButton, ConfirmButton } from "./action-button";
import { useAnnounce } from "./builder-context";
import { CategoryForm } from "./category-form";
import { count, ids } from "./format";
import { useDisclosure } from "./hooks";
import { ItemCard } from "./item-card";
import { ItemEditor } from "./item-editor";
import { Notice } from "./notice";

/** One active category: its heading and controls, its dishes in order, and "Add dish". */
export function CategorySection({
  restaurantId,
  category,
  items,
  archivedItemCount,
  position,
  total,
  focusAfterRemoval,
  categories,
  groups,
}: {
  restaurantId: string;
  category: EditableCategory;
  /** The category's active dishes, in menu order. */
  items: EditableItem[];
  archivedItemCount: number;
  /** Index among active categories. */
  position: number;
  total: number;
  /** Where keyboard focus goes if this category is archived or deleted. */
  focusAfterRemoval: string;
  categories: EditableCategory[];
  groups: EditableModifierGroup[];
}) {
  const announce = useAnnounce();
  const headingId = ids.categoryHeading(category.id);
  const editId = `category-${category.id}-edit`;
  const addId = `category-${category.id}-add-dish`;
  const editor = useDisclosure(editId);
  const adder = useDisclosure(addId);
  const [notice, setNotice] = useState<FormState | null>(null);
  const moveRequest = useRef<"up" | "down" | null>(null);
  const context = <span className="sr-only">: {category.name}</span>;

  // See ItemCard: after a move renders, return focus to the pressed move button.
  useEffect(() => {
    const direction = moveRequest.current;
    if (!direction) return;
    moveRequest.current = null;
    const pressed = document.getElementById(`category-${category.id}-move-${direction}`);
    const other = document.getElementById(
      `category-${category.id}-move-${direction === "up" ? "down" : "up"}`,
    );
    const target = [pressed, other].find(
      (el): el is HTMLButtonElement => el instanceof HTMLButtonElement && !el.disabled,
    );
    (target ?? document.getElementById(editId))?.focus();
  }, [position, category.id, editId]);

  const report = (state: FormState) => {
    if (state.status === "success") {
      setNotice(null);
      announce(state.message);
    } else {
      setNotice(state);
    }
  };
  const removed = (state: FormState) => {
    if (state.status === "success") announce(state.message, [focusAfterRemoval]);
    else setNotice(state);
  };

  const unavailable = items.filter((i) => !i.available).length;
  const summary = [
    items.length ? count(items.length, "dish", "dishes") : "No dishes",
    unavailable ? `${unavailable} unavailable` : null,
    archivedItemCount ? `${archivedItemCount} archived` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const empty = items.length === 0 && archivedItemCount === 0;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 border-t border-line pt-6">
      <div className="flex flex-col gap-1">
        <h2
          id={headingId}
          tabIndex={-1}
          className="m-0 font-sans text-heading text-brand wrap-break-word"
        >
          {category.name}
        </h2>
        <p className="m-0 font-sans text-small text-ink-muted">{summary}</p>
        {category.description ? (
          <p className="m-0 font-serif text-body-sm text-ink-muted">{category.description}</p>
        ) : null}
      </div>

      <div
        data-toolbar
        role="group"
        aria-label={`Category: ${category.name}`}
        className="flex flex-wrap gap-2"
      >
        <Button
          id={editId}
          variant="secondary"
          aria-expanded={editor.open}
          aria-controls={editor.open ? editor.panelId : undefined}
          onClick={() => {
            setNotice(null);
            editor.toggle();
          }}
        >
          Edit{context}
        </Button>
        <ActionButton
          id={`category-${category.id}-move-up`}
          variant="quiet"
          pendingLabel="Moving…"
          disabled={position === 0}
          action={moveCategory.bind(null, restaurantId, category.id, "up")}
          onResult={(state) => {
            moveRequest.current = state.status === "success" ? "up" : null;
            report(state);
          }}
        >
          Move up{context}
        </ActionButton>
        <ActionButton
          id={`category-${category.id}-move-down`}
          variant="quiet"
          pendingLabel="Moving…"
          disabled={position === total - 1}
          action={moveCategory.bind(null, restaurantId, category.id, "down")}
          onResult={(state) => {
            moveRequest.current = state.status === "success" ? "down" : null;
            report(state);
          }}
        >
          Move down{context}
        </ActionButton>
        <ActionButton
          variant="quiet"
          pendingLabel="Archiving…"
          action={archiveCategory.bind(null, restaurantId, category.id)}
          onResult={removed}
        >
          Archive{context}
        </ActionButton>
        {empty ? (
          <ConfirmButton
            id={`category-${category.id}-delete`}
            label={<>Delete{context}</>}
            question={`Delete ${category.name}? It has no dishes. This can’t be undone.`}
            confirmLabel="Delete category"
            action={deleteCategory.bind(null, restaurantId, category.id)}
            onResult={removed}
          />
        ) : null}
      </div>
      <Notice state={notice} />

      {editor.open ? (
        <div
          id={editor.panelId}
          className="flex flex-col gap-3 rounded-md border border-line bg-surface-alt p-4"
        >
          <h3 className="m-0 font-sans text-label text-ink">Edit category</h3>
          <CategoryForm
            restaurantId={restaurantId}
            category={category}
            onClose={editor.hide}
            onSaved={editor.hide}
          />
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {items.map((item, index) => (
            <ItemCard
              key={item.id}
              restaurantId={restaurantId}
              item={item}
              position={index}
              total={items.length}
              categories={categories}
              groups={groups}
            />
          ))}
        </ul>
      ) : (
        <p className="m-0 font-serif text-body-sm text-ink-muted">
          No dishes in this category yet.
        </p>
      )}

      <div>
        <Button
          id={addId}
          variant={items.length === 0 ? "primary" : "secondary"}
          aria-expanded={adder.open}
          aria-controls={adder.open ? adder.panelId : undefined}
          onClick={adder.toggle}
        >
          Add dish<span className="sr-only"> to {category.name}</span>
        </Button>
      </div>
      {adder.open ? (
        <div
          id={adder.panelId}
          className="flex flex-col gap-3 rounded-md border border-line bg-surface-alt p-4"
        >
          <h3 className="m-0 font-sans text-label text-ink">New dish in {category.name}</h3>
          <ItemEditor
            restaurantId={restaurantId}
            categoryId={category.id}
            categories={categories}
            groups={groups}
            onClose={adder.hide}
          />
        </div>
      ) : null}
    </section>
  );
}
