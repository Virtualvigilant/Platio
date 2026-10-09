"use client";

import { useState } from "react";
import { Button, Callout, CheckboxField, Pill, TextField } from "@/components/ui";
import { describeModifierRule, modifierGroupProblems } from "@/domain/menu/modifiers";
import { formatKES } from "@/domain/money";
import type { FormState } from "@/server/actions";
import {
  createModifierGroup,
  createModifierOption,
  deleteModifierGroup,
  deleteModifierOption,
  updateModifierGroup,
  updateModifierOption,
} from "@/server/menu/actions";
import type { EditableModifierGroup, EditableOption } from "@/server/menu/queries";
import { ConfirmButton } from "./action-button";
import { useAnnounce } from "./builder-context";
import { count, ids, toPriceInput } from "./format";
import { useDisclosure, useMenuForm } from "./hooks";
import { Notice } from "./notice";

const panelClass = "flex flex-col gap-3 rounded-md border border-line bg-surface-alt p-4";

/**
 * "Choices and add-ons": the restaurant's modifier groups (Size, Extras…) and their options. A
 * group is defined once and ticked on each dish that offers it.
 */
export function ModifierGroupsSection({
  restaurantId,
  groups,
  itemNames,
}: {
  restaurantId: string;
  groups: EditableModifierGroup[];
  /** Dish names by id, to show where each group is used. */
  itemNames: Record<string, string>;
}) {
  return (
    <section
      aria-labelledby={ids.choices}
      className="flex flex-col gap-4 border-t border-line pt-6"
    >
      <h2 id={ids.choices} tabIndex={-1} className="m-0 font-sans text-heading text-brand">
        Choices and add-ons
      </h2>
      <p className="m-0 font-serif text-body-sm text-ink-muted">
        Choices customers make when they order a dish, like Size or Extras. Create a group once,
        then tick it on each dish that offers it. Extra costs are added to the dish price.
      </p>
      {groups.length === 0 ? (
        <p className="m-0 font-serif text-body-sm text-ink-muted">No choice groups yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {groups.map((g) => (
            <GroupCard key={g.id} restaurantId={restaurantId} group={g} itemNames={itemNames} />
          ))}
        </ul>
      )}
      <AddGroup restaurantId={restaurantId} />
    </section>
  );
}

function usedByText(names: string[]): string {
  if (names.length === 0) return "Not on any dish yet. Tick it when you edit a dish.";
  const shown = names.slice(0, 4).join(", ");
  return names.length > 4
    ? `Offered with ${shown} and ${names.length - 4} more.`
    : `Offered with ${shown}.`;
}

function GroupCard({
  restaurantId,
  group,
  itemNames,
}: {
  restaurantId: string;
  group: EditableModifierGroup;
  itemNames: Record<string, string>;
}) {
  const announce = useAnnounce();
  const headingId = ids.groupHeading(group.id);
  const editId = `group-${group.id}-edit`;
  const addId = `group-${group.id}-add-option`;
  const editor = useDisclosure(editId);
  const adder = useDisclosure(addId);
  const [notice, setNotice] = useState<FormState | null>(null);
  const problems = modifierGroupProblems(group);
  const usedBy = group.itemIds.map((id) => itemNames[id]).filter((n): n is string => !!n);
  const context = <span className="sr-only">: {group.name}</span>;

  return (
    <li className="flex flex-col gap-3 rounded-md border border-line bg-surface-raised p-4">
      <div className="flex flex-col gap-1">
        <h3
          id={headingId}
          tabIndex={-1}
          className="m-0 font-sans text-label text-ink wrap-break-word"
        >
          {group.name}
        </h3>
        <p className="m-0 font-sans text-small text-ink-muted">{describeModifierRule(group)}</p>
        <p className="m-0 font-sans text-small text-ink-muted">{usedByText(usedBy)}</p>
      </div>

      {problems.map((problem) => (
        <Callout key={problem} tone="warning">
          {problem}
        </Callout>
      ))}

      {group.options.length > 0 ? (
        <ul className="m-0 flex list-none flex-col border-t border-line p-0">
          {group.options.map((o) => (
            <OptionRow
              key={o.id}
              restaurantId={restaurantId}
              option={o}
              groupHeadingId={headingId}
            />
          ))}
        </ul>
      ) : null}

      <div
        data-toolbar
        role="group"
        aria-label={`Choice group: ${group.name}`}
        className="flex flex-wrap gap-2"
      >
        <Button
          id={addId}
          variant="secondary"
          aria-expanded={adder.open}
          aria-controls={adder.open ? adder.panelId : undefined}
          onClick={adder.toggle}
        >
          Add option{context}
        </Button>
        <Button
          id={editId}
          variant="quiet"
          aria-expanded={editor.open}
          aria-controls={editor.open ? editor.panelId : undefined}
          onClick={() => {
            setNotice(null);
            editor.toggle();
          }}
        >
          Edit group{context}
        </Button>
        <ConfirmButton
          id={`group-${group.id}-delete`}
          label={<>Delete group{context}</>}
          question={`Delete ${group.name} and its options?${
            usedBy.length ? ` ${count(usedBy.length, "dish", "dishes")} will stop offering it.` : ""
          } Past orders keep the choices customers made.`}
          confirmLabel="Delete group"
          action={deleteModifierGroup.bind(null, restaurantId, group.id)}
          onResult={(state) => {
            if (state.status === "success") announce(state.message, [ids.choices]);
            else setNotice(state);
          }}
        />
      </div>
      <Notice state={notice} />

      {adder.open ? (
        <div id={adder.panelId} className={panelClass}>
          <h4 className="m-0 font-sans text-label text-ink">New option for {group.name}</h4>
          <OptionForm restaurantId={restaurantId} groupId={group.id} onClose={adder.hide} />
        </div>
      ) : null}
      {editor.open ? (
        <div id={editor.panelId} className={panelClass}>
          <h4 className="m-0 font-sans text-label text-ink">Edit {group.name}</h4>
          <GroupForm
            restaurantId={restaurantId}
            group={group}
            onClose={editor.hide}
            onSaved={editor.hide}
          />
        </div>
      ) : null}
    </li>
  );
}

function OptionRow({
  restaurantId,
  option,
  groupHeadingId,
}: {
  restaurantId: string;
  option: EditableOption;
  groupHeadingId: string;
}) {
  const announce = useAnnounce();
  const editId = `option-${option.id}-edit`;
  const editor = useDisclosure(editId);
  const [notice, setNotice] = useState<FormState | null>(null);
  const context = <span className="sr-only">: {option.name}</span>;

  return (
    <li className="flex flex-col gap-2 border-b border-line py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="font-sans text-ui text-ink wrap-break-word">{option.name}</span>
        <span className="font-sans text-ui text-ink tabular-nums">
          {option.priceDeltaMinor ? `+ ${formatKES(option.priceDeltaMinor)}` : "No extra cost"}
        </span>
      </div>
      {option.active ? null : (
        <div>
          <Pill tone="neutral" form="soft" glyph="slash">
            Not offered
          </Pill>
        </div>
      )}
      <div data-toolbar className="flex flex-wrap gap-2">
        <Button
          id={editId}
          variant="quiet"
          aria-expanded={editor.open}
          aria-controls={editor.open ? editor.panelId : undefined}
          onClick={() => {
            setNotice(null);
            editor.toggle();
          }}
        >
          Edit{context}
        </Button>
        <ConfirmButton
          id={`option-${option.id}-delete`}
          label={<>Delete{context}</>}
          question={`Delete ${option.name}? Past orders keep it. To hide it for now, edit it and untick “Offer this option” instead.`}
          confirmLabel="Delete option"
          action={deleteModifierOption.bind(null, restaurantId, option.id)}
          onResult={(state) => {
            if (state.status === "success") announce(state.message, [groupHeadingId]);
            else setNotice(state);
          }}
        />
      </div>
      <Notice state={notice} />
      {editor.open ? (
        <div id={editor.panelId} className={panelClass}>
          <OptionForm
            restaurantId={restaurantId}
            option={option}
            onClose={editor.hide}
            onSaved={editor.hide}
          />
        </div>
      ) : null}
    </li>
  );
}

function GroupForm({
  restaurantId,
  group,
  onClose,
  onSaved,
}: {
  restaurantId: string;
  group?: EditableModifierGroup;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const action = group
    ? updateModifierGroup.bind(null, restaurantId, group.id)
    : createModifierGroup.bind(null, restaurantId);
  const p = group ? `group-${group.id}` : "new-group";
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
      <div key={group ? "edit" : form.saves} className="flex flex-col gap-4">
        <TextField
          id={`${p}-name`}
          name="name"
          label="Group name"
          hint="What customers choose, like Size, Side or Extras."
          defaultValue={group?.name ?? ""}
          error={form.error("name")}
          maxLength={60}
          autoComplete="off"
          required
        />
        <CheckboxField
          id={`${p}-required`}
          name="required"
          label="Customers must choose from this group"
          defaultChecked={group?.required ?? false}
          error={form.error("required")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id={`${p}-minSelect`}
            name="minSelect"
            label="Fewest choices"
            hint="At least 1 for a required group."
            type="number"
            inputMode="numeric"
            min={0}
            max={20}
            defaultValue={String(group?.minSelect ?? 0)}
            error={form.error("minSelect")}
          />
          <TextField
            id={`${p}-maxSelect`}
            name="maxSelect"
            label="Most choices"
            hint="1 for a single choice, like Size."
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            defaultValue={String(group?.maxSelect ?? 1)}
            error={form.error("maxSelect")}
          />
        </div>
      </div>
      <Notice state={form.state} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={form.pending} loadingLabel="Saving…">
          {group ? "Save group" : "Add group"}
        </Button>
        <Button variant="quiet" onClick={onClose}>
          {group ? "Cancel" : "Close"}
        </Button>
      </div>
    </form>
  );
}

function OptionForm({
  restaurantId,
  groupId,
  option,
  onClose,
  onSaved,
}: {
  restaurantId: string;
  groupId?: string;
  option?: EditableOption;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const action = option
    ? updateModifierOption.bind(null, restaurantId, option.id)
    : createModifierOption.bind(null, restaurantId, groupId ?? "");
  const p = option ? `option-${option.id}` : `new-option-${groupId}`;
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
      <div key={option ? "edit" : form.saves} className="flex flex-col gap-4">
        <TextField
          id={`${p}-name`}
          name="name"
          label="Option"
          hint="Like Large or Extra avocado."
          defaultValue={option?.name ?? ""}
          error={form.error("name")}
          maxLength={60}
          autoComplete="off"
          required
        />
        <TextField
          id={`${p}-priceDelta`}
          name="priceDelta"
          label="Extra cost (KES)"
          optional
          hint="Added to the dish price. Leave empty if it’s free."
          inputMode="decimal"
          autoComplete="off"
          defaultValue={option?.priceDeltaMinor ? toPriceInput(option.priceDeltaMinor) : ""}
          error={form.error("priceDelta")}
        />
        {option ? (
          <CheckboxField
            id={`${p}-active`}
            name="active"
            label="Offer this option"
            hint="Untick to hide it from customers without deleting it."
            defaultChecked={option.active}
          />
        ) : null}
      </div>
      <Notice state={form.state} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={form.pending} loadingLabel="Saving…">
          {option ? "Save option" : "Add option"}
        </Button>
        <Button variant="quiet" onClick={onClose}>
          {option ? "Cancel" : "Close"}
        </Button>
      </div>
    </form>
  );
}

function AddGroup({ restaurantId }: { restaurantId: string }) {
  const triggerId = "menu-add-group";
  const panel = useDisclosure(triggerId);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button
          id={triggerId}
          variant="secondary"
          aria-expanded={panel.open}
          aria-controls={panel.open ? panel.panelId : undefined}
          onClick={panel.toggle}
        >
          Add choice group
        </Button>
      </div>
      {panel.open ? (
        <div id={panel.panelId} className={panelClass}>
          <h3 className="m-0 font-sans text-label text-ink">New choice group</h3>
          <GroupForm restaurantId={restaurantId} onClose={panel.hide} />
        </div>
      ) : null}
    </div>
  );
}
