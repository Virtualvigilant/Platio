"use client";

import { useEffect, useRef, useState } from "react";
import { Button, MenuItem, Pill } from "@/components/ui";
import type { FormState } from "@/server/actions";
import { archiveMenuItem, moveMenuItem, setMenuItemAvailability } from "@/server/menu/actions";
import type { EditableCategory, EditableItem, EditableModifierGroup } from "@/server/menu/queries";
import { ActionButton } from "./action-button";
import { useAnnounce } from "./builder-context";
import { ids } from "./format";
import { useDisclosure } from "./hooks";
import { ItemEditor } from "./item-editor";
import { Notice } from "./notice";

/**
 * One active dish as customers will see it (the storefront's MenuItem), with its controls and an
 * inline editor underneath.
 */
export function ItemCard({
  restaurantId,
  item,
  position,
  total,
  categories,
  groups,
}: {
  restaurantId: string;
  item: EditableItem;
  /** Index among the category's active dishes. */
  position: number;
  total: number;
  categories: EditableCategory[];
  groups: EditableModifierGroup[];
}) {
  const announce = useAnnounce();
  const editId = ids.itemEdit(item.id);
  const editor = useDisclosure(editId);
  const [notice, setNotice] = useState<FormState | null>(null);
  const moveRequest = useRef<"up" | "down" | null>(null);
  const context = <span className="sr-only">: {item.name}</span>;

  // Moving a row re-inserts it in the list, which can drop keyboard focus. Once the new position
  // has rendered, put focus back on the move button that was pressed (or its partner at an end).
  useEffect(() => {
    const direction = moveRequest.current;
    if (!direction) return;
    moveRequest.current = null;
    const pressed = document.getElementById(`item-${item.id}-move-${direction}`);
    const other = document.getElementById(
      `item-${item.id}-move-${direction === "up" ? "down" : "up"}`,
    );
    const target = [pressed, other].find(
      (el): el is HTMLButtonElement => el instanceof HTMLButtonElement && !el.disabled,
    );
    (target ?? document.getElementById(editId))?.focus();
  }, [position, item.id, editId]);

  const report = (state: FormState) => {
    if (state.status === "success") {
      setNotice(null);
      announce(state.message);
    } else {
      setNotice(state);
    }
  };

  const groupNames = item.modifierGroupIds
    .map((id) => groups.find((g) => g.id === id)?.name)
    .filter((name): name is string => !!name);

  return (
    <li className="rounded-md border border-line bg-surface-raised px-4">
      <MenuItem
        name={item.name}
        description={item.description}
        priceMinor={item.priceMinor}
        prepMinutes={item.prepMinutes}
        tags={item.tags}
        imageUrl={item.imageUrl}
        available={item.available}
        action={
          <Pill tone="brand" form="outline" glyph="check">
            Available
          </Pill>
        }
      />
      {groupNames.length > 0 ? (
        <p className="m-0 pt-3 font-sans text-small text-ink-muted">
          Choices: {groupNames.join(" · ")}
        </p>
      ) : null}
      <div
        data-toolbar
        role="group"
        aria-label={`Actions for ${item.name}`}
        className="flex flex-wrap gap-2 py-3"
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
          variant="quiet"
          pendingLabel="Saving…"
          action={setMenuItemAvailability.bind(
            null,
            restaurantId,
            item.id,
            item.available ? "unavailable" : "available",
          )}
          onResult={report}
        >
          {item.available ? "Mark unavailable" : "Mark available"}
          {context}
        </ActionButton>
        <ActionButton
          id={`item-${item.id}-move-up`}
          variant="quiet"
          pendingLabel="Moving…"
          disabled={position === 0}
          action={moveMenuItem.bind(null, restaurantId, item.id, "up")}
          onResult={(state) => {
            moveRequest.current = state.status === "success" ? "up" : null;
            report(state);
          }}
        >
          Move up{context}
        </ActionButton>
        <ActionButton
          id={`item-${item.id}-move-down`}
          variant="quiet"
          pendingLabel="Moving…"
          disabled={position === total - 1}
          action={moveMenuItem.bind(null, restaurantId, item.id, "down")}
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
          action={archiveMenuItem.bind(null, restaurantId, item.id)}
          onResult={(state) => {
            if (state.status === "success") {
              // The card leaves the list; continue from its category.
              announce(state.message, [ids.categoryHeading(item.categoryId)]);
            } else {
              setNotice(state);
            }
          }}
        >
          Archive{context}
        </ActionButton>
      </div>
      {notice ? (
        <div className="pb-3">
          <Notice state={notice} />
        </div>
      ) : null}
      {editor.open ? (
        <div id={editor.panelId} className="flex flex-col gap-3 border-t border-line py-4">
          <h4 className="m-0 font-sans text-label text-ink">Edit {item.name}</h4>
          <ItemEditor
            restaurantId={restaurantId}
            item={item}
            categoryId={item.categoryId}
            categories={categories}
            groups={groups}
            onClose={editor.hide}
            onSaved={editor.hide}
          />
        </div>
      ) : null}
    </li>
  );
}
