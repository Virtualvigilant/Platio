import { Callout } from "@/components/ui";
import type { MenuForEditing } from "@/server/menu/queries";
import { ArchivedArea } from "./archived-area";
import { BuilderProvider } from "./builder-context";
import { AddCategory } from "./category-form";
import { CategorySection } from "./category-section";
import { count, ids } from "./format";
import { ModifierGroupsSection } from "./modifier-groups";

/**
 * The menu builder (brief §6.3, §7.2 step 5) for platform staff, owners and managers: categories
 * and dishes in menu order, the restaurant's choice groups, and everything archived. Every change
 * goes through a Server Action that checks the restaurant again; edits to a live restaurant show
 * to customers as soon as they're saved.
 */
export function MenuBuilder({
  restaurantId,
  menu,
}: {
  restaurantId: string;
  menu: MenuForEditing;
}) {
  const activeCategories = menu.categories.filter((c) => c.active);
  const archivedCategories = menu.categories.filter((c) => !c.active);
  const activeCategoryIds = new Set(activeCategories.map((c) => c.id));

  const itemCountByCategory: Record<string, number> = {};
  for (const item of menu.items) {
    itemCountByCategory[item.categoryId] = (itemCountByCategory[item.categoryId] ?? 0) + 1;
  }
  const categoryNames = Object.fromEntries(menu.categories.map((c) => [c.id, c.name]));
  const itemNames = Object.fromEntries(menu.items.map((i) => [i.id, i.name]));

  const onMenu = menu.items.filter((i) => i.active && activeCategoryIds.has(i.categoryId));
  const unavailable = onMenu.filter((i) => !i.available).length;
  const archivedItems = menu.items.filter((i) => !i.active);

  const summary =
    menu.categories.length === 0
      ? "No categories yet."
      : [
          count(activeCategories.length, "category", "categories"),
          `${count(onMenu.length, "dish", "dishes")} on the menu`,
          unavailable ? `${unavailable} unavailable` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <BuilderProvider>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <p id={ids.top} tabIndex={-1} className="m-0 font-sans text-label text-ink">
            {summary}
          </p>
          <p className="m-0 font-serif text-body-sm text-ink-muted">
            Mark a dish unavailable when it sells out for the day; archive it to take it off the
            menu. Price changes apply to new orders only. Past orders keep the prices customers
            paid.
          </p>
          {menu.items.length === 0 ? (
            <Callout tone="info">No dishes yet. Add a category, then add dishes to it.</Callout>
          ) : null}
        </div>

        {activeCategories.map((category, index) => (
          <CategorySection
            key={category.id}
            restaurantId={restaurantId}
            category={category}
            items={menu.items.filter((i) => i.active && i.categoryId === category.id)}
            archivedItemCount={
              menu.items.filter((i) => !i.active && i.categoryId === category.id).length
            }
            position={index}
            total={activeCategories.length}
            focusAfterRemoval={
              index > 0
                ? ids.categoryHeading(activeCategories[index - 1].id)
                : activeCategories[1]
                  ? ids.categoryHeading(activeCategories[1].id)
                  : ids.top
            }
            categories={menu.categories}
            groups={menu.modifierGroups}
          />
        ))}

        <AddCategory restaurantId={restaurantId} prominent={activeCategories.length === 0} />

        <ModifierGroupsSection
          restaurantId={restaurantId}
          groups={menu.modifierGroups}
          itemNames={itemNames}
        />

        {archivedCategories.length + archivedItems.length > 0 ? (
          <ArchivedArea
            restaurantId={restaurantId}
            categories={archivedCategories}
            items={archivedItems}
            itemCountByCategory={itemCountByCategory}
            categoryNames={categoryNames}
          />
        ) : null}
      </div>
    </BuilderProvider>
  );
}
