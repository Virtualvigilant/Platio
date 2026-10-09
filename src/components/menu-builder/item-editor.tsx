"use client";

import {
  Button,
  CheckboxField,
  Fieldset,
  ImageField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui";
import { describeModifierRule } from "@/domain/menu/modifiers";
import { createMenuItem, updateMenuItem } from "@/server/menu/actions";
import type { EditableCategory, EditableItem, EditableModifierGroup } from "@/server/menu/queries";
import { count, ids, toPriceInput } from "./format";
import { useMenuForm } from "./hooks";
import { Notice } from "./notice";

/**
 * Adds a dish to `categoryId` (no `item`) or edits one. The price is typed in shillings and
 * becomes integer cents on the server; nothing here calculates money.
 */
export function ItemEditor({
  restaurantId,
  item,
  categoryId,
  categories,
  groups,
  onClose,
  onSaved,
}: {
  restaurantId: string;
  item?: EditableItem;
  categoryId: string;
  categories: EditableCategory[];
  groups: EditableModifierGroup[];
  onClose: () => void;
  onSaved?: () => void;
}) {
  const action = item
    ? updateMenuItem.bind(null, restaurantId, item.id)
    : createMenuItem.bind(null, restaurantId);
  const p = item ? `item-${item.id}` : `new-item-${categoryId}`;
  const formId = `${p}-form`;
  const form = useMenuForm(action, { formId, onSuccess: onSaved });

  return (
    <form
      id={formId}
      action={form.dispatch}
      onSubmit={form.onSubmit}
      noValidate
      className="flex flex-col gap-4"
    >
      {/* Re-keyed after each "add", so the fields (and the chosen photo) clear for the next dish. */}
      <div key={item ? "edit" : form.saves} className="flex flex-col gap-4">
        <TextField
          id={`${p}-name`}
          name="name"
          label="Dish name"
          defaultValue={item?.name ?? ""}
          error={form.error("name")}
          maxLength={80}
          autoComplete="off"
          required
        />
        <TextAreaField
          id={`${p}-description`}
          name="description"
          label="Description"
          optional
          hint="What’s in it, in a sentence."
          defaultValue={item?.description ?? ""}
          error={form.error("description")}
          maxLength={300}
          rows={2}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id={`${p}-price`}
            name="price"
            label="Price (KES)"
            hint="Like 350 or 350.50."
            inputMode="decimal"
            autoComplete="off"
            defaultValue={item ? toPriceInput(item.priceMinor) : ""}
            error={form.error("price")}
            required
          />
          <TextField
            id={`${p}-prepMinutes`}
            name="prepMinutes"
            label="Preparation time (minutes)"
            optional
            hint="Used to suggest the estimated ready time."
            inputMode="numeric"
            autoComplete="off"
            defaultValue={item?.prepMinutes?.toString() ?? ""}
            error={form.error("prepMinutes")}
          />
        </div>
        <p className="m-0 font-sans text-small text-ink-muted">
          Price changes apply to new orders only. Past orders keep the prices customers paid.
        </p>
        <TextField
          id={`${p}-tags`}
          name="tags"
          label="Labels"
          optional
          hint="Separate with commas, like Vegetarian, Spicy. Up to 6."
          defaultValue={item?.tags.join(", ") ?? ""}
          error={form.error("tags")}
          autoComplete="off"
        />
        <SelectField
          id={`${p}-category`}
          name="categoryId"
          label="Category"
          defaultValue={item?.categoryId ?? categoryId}
          error={form.error("categoryId")}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.active ? c.name : `${c.name} (archived)`}
            </option>
          ))}
        </SelectField>
        <ImageField
          name="image"
          label="Photo (optional)"
          hint="PNG, JPEG or WebP, up to 2 MB. A square photo works best."
          currentUrl={item?.imageUrl}
          removeName={item ? "removeImage" : undefined}
          error={form.error("image")}
        />
        <Fieldset
          legend="Choices and add-ons"
          hint="Tick the groups customers choose from when they order this dish."
        >
          {groups.length === 0 ? (
            <p className="m-0 font-sans text-small text-ink-muted">
              No choice groups yet. Create them under{" "}
              <a href={`#${ids.choices}`}>Choices and add-ons</a>, then tick them here.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {groups.map((g) => (
                <CheckboxField
                  key={g.id}
                  id={`${p}-group-${g.id}`}
                  name="modifierGroupIds"
                  value={g.id}
                  label={g.name}
                  hint={`${describeModifierRule(g)} · ${count(
                    g.options.filter((o) => o.active).length,
                    "option",
                    "options",
                  )}`}
                  defaultChecked={item?.modifierGroupIds.includes(g.id) ?? false}
                />
              ))}
            </div>
          )}
        </Fieldset>
      </div>
      <Notice state={form.state} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={form.pending} loadingLabel="Saving…">
          {item ? "Save dish" : "Add dish"}
        </Button>
        <Button variant="quiet" onClick={onClose}>
          {item ? "Cancel" : "Close"}
        </Button>
      </div>
    </form>
  );
}
