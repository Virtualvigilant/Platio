"use client";

import { Button, TextAreaField, TextField } from "@/components/ui";
import { createCategory, updateCategory } from "@/server/menu/actions";
import type { EditableCategory } from "@/server/menu/queries";
import { ids } from "./format";
import { useDisclosure, useMenuForm } from "./hooks";
import { Notice } from "./notice";

/** Adds a category (no `category`) or edits one. */
export function CategoryForm({
  restaurantId,
  category,
  onClose,
  onSaved,
}: {
  restaurantId: string;
  category?: EditableCategory;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const action = category
    ? updateCategory.bind(null, restaurantId, category.id)
    : createCategory.bind(null, restaurantId);
  const prefix = category ? `category-${category.id}` : "new-category";
  const formId = `${prefix}-form`;
  const form = useMenuForm(action, { formId, onSuccess: onSaved });

  return (
    <form
      id={formId}
      action={form.dispatch}
      onSubmit={form.onSubmit}
      noValidate
      className="flex flex-col gap-4"
    >
      {/* Re-keyed after each "add", so the fields clear for the next category. */}
      <div key={category ? "edit" : form.saves} className="flex flex-col gap-4">
        <TextField
          id={`${prefix}-name`}
          name="name"
          label="Category name"
          hint="Like Breakfast, Main dishes or Drinks."
          defaultValue={category?.name ?? ""}
          error={form.error("name")}
          maxLength={60}
          autoComplete="off"
          required
        />
        <TextAreaField
          id={`${prefix}-description`}
          name="description"
          label="Description"
          optional
          hint="Shown under the category name, like “Served until 11:00”."
          defaultValue={category?.description ?? ""}
          error={form.error("description")}
          maxLength={200}
          rows={2}
        />
      </div>
      <Notice state={form.state} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={form.pending} loadingLabel="Saving…">
          {category ? "Save category" : "Add category"}
        </Button>
        <Button variant="quiet" onClick={onClose}>
          {category ? "Cancel" : "Close"}
        </Button>
      </div>
    </form>
  );
}

/** "Add category" and the form it opens. */
export function AddCategory({
  restaurantId,
  prominent,
}: {
  restaurantId: string;
  prominent: boolean;
}) {
  const panel = useDisclosure(ids.addCategory);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button
          id={ids.addCategory}
          variant={prominent ? "primary" : "secondary"}
          aria-expanded={panel.open}
          aria-controls={panel.open ? panel.panelId : undefined}
          onClick={panel.toggle}
        >
          Add category
        </Button>
      </div>
      {panel.open ? (
        <div
          id={panel.panelId}
          className="flex flex-col gap-3 rounded-md border border-line bg-surface-alt p-4"
        >
          <h2 className="m-0 font-sans text-label text-ink">New category</h2>
          <CategoryForm restaurantId={restaurantId} onClose={panel.hide} />
        </div>
      ) : null}
    </div>
  );
}
